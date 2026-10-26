from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.catalog import Brand, Category, Product
from app.models.commerce import Order, OrderItem, OrderStatus, OrderStatusHistory, PaymentMethod, ShippingMethod
from app.models.user import User, UserRole
from app.services.analytics_report import get_report
from tests.conftest import register_and_login


def test_report_permissions_dates_and_empty_state(client, db):
    url = '/api/v1/admin/analytics/report?start_date=2026-10-01&end_date=2026-10-31'
    assert client.get(url).status_code == 401
    tokens = register_and_login(client, {'email': 'report@example.com', 'password': 'StrongPassword123!',
                                        'first_name': 'Report', 'last_name': 'Tester'})
    headers = {'Authorization': f"Bearer {tokens['access_token']}"}
    assert client.get(url, headers=headers).status_code == 403
    user = db.scalar(select(User).where(User.email == 'report@example.com'))
    user.role = UserRole.ADMIN
    db.commit()
    response = client.get(url, headers=headers)
    assert response.status_code == 200
    report = response.json()
    assert Decimal(report['current']['order_value']) == 0
    assert len(report['series']) == 31
    assert report['categories'] == report['products'] == []
    assert 'profit' in report['unavailable']
    for query in ['start_date=2026-10-02&end_date=2026-10-01',
                  'start_date=2025-01-01&end_date=2026-10-01',
                  'start_date=bad&end_date=2026-10-01',
                  'start_date=2026-10-01&end_date=2026-10-02&timezone=Unknown']:
        assert client.get('/api/v1/admin/analytics/report?' + query, headers=headers).status_code == 422


def test_report_timezone_comparison_category_and_statuses(db):
    user = User(email='report-data@example.com', password_hash='unused', first_name='Data', last_name='Test')
    brand = Brand(name='Report brand', slug='report-brand')
    category = Category(name='Brakes', slug='report-brakes')
    other = Category(name='Filters', slug='report-filters')
    db.add_all([user, brand, category, other])
    db.flush()
    product = Product(name='Brake', sku='REPORT-1', slug='report-1', brand_id=brand.id,
                      category_id=category.id, price=Decimal('100'), stock_quantity=3)
    second = Product(name='Filter', sku='REPORT-2', slug='report-2', brand_id=brand.id,
                     category_id=other.id, price=Decimal('50'), stock_quantity=0)
    db.add_all([product, second])
    db.flush()

    def order(number, timestamp, total, status=OrderStatus.COMPLETED, currency='TJS', item_product=product):
        row = Order(number=number, user_id=user.id,
                    created_at=datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc),
                    status=status, subtotal=total, total=total, currency=currency,
                    shipping_method=ShippingMethod.PICKUP, payment_method=PaymentMethod.CASH_ON_DELIVERY,
                    contact_name='Test', contact_phone='+992900000000', contact_email=user.email,
                    shipping_city='Dushanbe', shipping_street='Test')
        db.add(row)
        db.flush()
        db.add(OrderItem(order_id=row.id, product_id=item_product.id, product_name=item_product.name,
                         product_sku=item_product.sku, quantity=1, unit_price=total, line_total=total))
        return row

    # Midnight in Dushanbe is 19:00 the preceding UTC day.
    order('REPORT-BEFORE', '2026-09-30T18:59:59', Decimal('40'))
    first = order('REPORT-START', '2026-09-30T19:00:00', Decimal('100'))
    for hour in [21, 22]:
        db.add(OrderStatusHistory(order_id=first.id, from_status=OrderStatus.PENDING,
               to_status=OrderStatus.CONFIRMED, created_at=datetime(2026, 9, 30, hour, tzinfo=timezone.utc)))
    order('REPORT-END', '2026-10-01T18:59:59', Decimal('200'))
    order('REPORT-AFTER', '2026-10-01T19:00:00', Decimal('800'))
    order('REPORT-CANCELLED', '2026-10-01T10:00:00', Decimal('500'), OrderStatus.CANCELLED)
    order('REPORT-RETURN', '2026-10-01T10:00:00', Decimal('600'), OrderStatus.RETURNED)
    order('REPORT-USD', '2026-10-01T10:00:00', Decimal('9000'), currency='USD')
    order('REPORT-OTHER-CAT', '2026-10-01T10:00:00', Decimal('50'), item_product=second)
    db.commit()
    report = get_report(db, date(2026, 10, 1), date(2026, 10, 1), category_id=category.id)
    assert report.current.order_value == Decimal('300')
    assert report.previous.order_value == Decimal('40')
    assert report.current.orders == 4
    assert report.current.valid_orders == 2
    assert report.current.cancelled == report.current.returned == 1
    assert report.current.returned_order_value == Decimal('600')
    assert report.current.average_order_value == Decimal('150')
    assert report.current.buyers == report.current.repeat_buyers == 1
    assert report.current.units == 2
    assert report.series[0].order_value == Decimal('300')
    assert report.series[0].previous_order_value == Decimal('40')
    assert report.categories[0].item_value == Decimal('300')
    assert report.brands[0].units == 2
    assert report.stock['low_stock'] == 1
    assert report.stock['out_of_stock'] == 0
    assert report.products_without_sales == 0
    assert report.low_stock_products[0].sku == product.sku
    assert report.reached_stages[0].count == 1
    assert report.processing_hours['confirmed'] == 2
    assert sum(row.count for row in report.statuses) == 4
    for grain in ['day', 'week', 'month']:
        grouped = get_report(db, date(2026, 10, 1), date(2026, 10, 8), grain=grain)
        assert sum(row.order_value for row in grouped.series) == grouped.current.order_value
        assert sum(row.previous_order_value for row in grouped.series) == grouped.previous.order_value
        assert sum(row.orders for row in grouped.series) == grouped.current.orders
    utc = get_report(db, date(2026, 10, 1), date(2026, 10, 1), timezone_name='UTC', category_id=category.id)
    assert utc.current.order_value == Decimal('1000')
