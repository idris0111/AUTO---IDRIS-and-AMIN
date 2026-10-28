"""Bounded SQL aggregates. See docs/ANALYTICS_METRICS.md for accounting scope."""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, case, desc, distinct, exists, func, select
from sqlalchemy.orm import Session, aliased

from app.models.catalog import Brand, Category, Product, ProductStatus
from app.models.commerce import Order, OrderItem, OrderStatus, OrderStatusHistory
from app.models.inventory import MovementType, StockMovement
from app.schemas.analytics_report import (
    AnalyticsReport, ProcurementSignal, ReportPoint, ReportProduct, ReportSegment,
    ReasonCount, ReportStatus, ReportSummary, StaleOrderSignal,
)

EXCLUDED = [OrderStatus.CANCELLED, OrderStatus.RETURNED]


def get_report(db: Session, start_date: date, end_date: date, grain: str = 'day',
               timezone_name: str = 'Asia/Dushanbe', category_id: UUID | None = None,
               comparison: str = 'previous_period') -> AnalyticsReport:
    # Supported local zones currently share UTC+05 without DST; no OS tzdata dependency.
    offset = 0 if timezone_name == 'UTC' else 5
    tz = timezone(timedelta(hours=offset))
    start = datetime.combine(start_date, time.min, tz).astimezone(timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), time.min, tz).astimezone(timezone.utc)
    duration = end - start
    if comparison == 'previous_year':
        def last_year(day: date) -> date:
            try:
                return day.replace(year=day.year - 1)
            except ValueError:  # Feb 29 -> Feb 28 in a non-leap year.
                return day.replace(year=day.year - 1, day=28)
        previous_start_date = last_year(start_date)
        previous_end_date = last_year(end_date)
    else:
        previous_start_date = start_date - timedelta(days=duration.days)
        previous_end_date = start_date - timedelta(days=1)
    previous_start = datetime.combine(previous_start_date, time.min, tz).astimezone(timezone.utc)
    previous_end = datetime.combine(previous_end_date + timedelta(days=1), time.min, tz).astimezone(timezone.utc)
    scope = [Order.currency == 'TJS']
    if category_id:
        # Order-level metrics retain full value of orders containing this category.
        scope.append(exists(select(OrderItem.id).join(Product).where(
            OrderItem.order_id == Order.id, Product.category_id == category_id)))

    def summary(a: datetime, b: datetime) -> ReportSummary:
        period = [*scope, Order.created_at >= a, Order.created_at < b]
        valid = [*period, Order.status.notin_(EXCLUDED)]
        value, count, buyers, discounts, shipping = db.execute(select(
            func.coalesce(func.sum(Order.total), 0), func.count(Order.id),
            func.count(distinct(Order.user_id)),
            func.coalesce(func.sum(Order.discount + Order.points_discount), 0),
            func.coalesce(func.sum(Order.shipping_cost), 0),
        ).where(*valid)).one()
        prior = aliased(Order)
        repeat = db.scalar(select(func.count(distinct(Order.user_id))).where(*valid, exists(
            select(prior.id).where(prior.user_id == Order.user_id, prior.created_at < a,
                                   prior.currency == 'TJS', prior.status.notin_(EXCLUDED))))) or 0
        units = db.scalar(select(func.coalesce(func.sum(OrderItem.quantity), 0)).join(
            Order, Order.id == OrderItem.order_id).where(*valid)) or 0
        total, cancelled, returned, returned_value = db.execute(select(
            func.count(Order.id),
            func.coalesce(func.sum(case((Order.status == OrderStatus.CANCELLED, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Order.status == OrderStatus.RETURNED, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Order.status == OrderStatus.RETURNED, Order.total), else_=0)), 0),
        ).where(*period)).one()
        return ReportSummary(order_value=value, orders=total, valid_orders=count,
                             average_order_value=round(Decimal(value) / count, 2) if count else 0,
                             buyers=buyers, repeat_buyers=repeat, units=units, discounts=discounts,
                             shipping=shipping, cancelled=cancelled, returned=returned,
                             returned_order_value=returned_value)

    # Group on the database, fetch <= 732 daily rows; no per-order queries.
    if db.get_bind().dialect.name == 'sqlite':
        local_day = func.date(Order.created_at, f'+{offset} hours')
    else:
        # UTCDateTime compiles to timezone-aware timestamps on PostgreSQL.
        local_day = func.date(func.timezone(timezone_name, Order.created_at))
    daily = db.execute(select(local_day,
        func.coalesce(func.sum(case((Order.status.notin_(EXCLUDED), Order.total), else_=0)), 0),
        func.count(Order.id)).where(*scope, Order.created_at >= previous_start, Order.created_at < end)
        .group_by(local_day)).all()
    by_date = {str(d): (v, n) for d, v, n in daily}

    def bucket(d: date) -> date:
        if grain == 'week':
            return d - timedelta(days=d.weekday())
        if grain == 'month':
            return d.replace(day=1)
        return d

    points: dict[date, ReportPoint] = {}
    for i in range(duration.days):
        d = start_date + timedelta(days=i)
        key = bucket(d)
        point = points.setdefault(key, ReportPoint(date=key, order_value=0, previous_order_value=0, orders=0))
        value, count = by_date.get(d.isoformat(), (Decimal(0), 0))
        if comparison == 'previous_year':
            try:
                previous_day = d.replace(year=d.year - 1)
            except ValueError:
                previous_day = d.replace(year=d.year - 1, day=28)
        else:
            previous_day = d - duration
        prev, _ = by_date.get(previous_day.isoformat(), (Decimal(0), 0))
        point.order_value += value
        point.previous_order_value += prev
        point.orders += count

    valid = [*scope, Order.created_at >= start, Order.created_at < end, Order.status.notin_(EXCLUDED)]
    demo_marker = Order.customer_note.like('[DEMO ANALYTICS]%')
    demo_orders_in_period = db.scalar(select(func.count(Order.id)).where(
        *scope, Order.created_at >= start, Order.created_at < end, demo_marker,
    )) or 0
    # This is deliberately a sandbox-only illustrative gross margin, not actual
    # profit: the demo fixture assumes cost is 72% of item value and ignores OPEX.
    demo_item_value = db.scalar(select(func.coalesce(func.sum(OrderItem.line_total), 0))
        .select_from(OrderItem).join(Order, Order.id == OrderItem.order_id)
        .where(*valid, demo_marker)) or Decimal('0')
    demo_gross_profit = (Decimal(demo_item_value) * Decimal('0.28')).quantize(Decimal('0.01'))

    def segments(model, foreign_key) -> list[ReportSegment]:
        rows = db.execute(select(model.id, model.name, func.sum(OrderItem.quantity),
                                 func.sum(OrderItem.line_total).label('value'))
            .select_from(OrderItem).join(Order).join(Product, Product.id == OrderItem.product_id)
            .join(model, model.id == foreign_key).where(*valid)
            .group_by(model.id, model.name).order_by(desc('value')).limit(50)).all()
        return [ReportSegment(id=id_, name=name, units=units, item_value=value)
                for id_, name, units, value in rows]

    product_rows = db.execute(select(Product.id, Product.name, Product.sku, Product.stock_quantity,
        func.sum(OrderItem.quantity).label('units'), func.sum(OrderItem.line_total))
        .select_from(OrderItem).join(Order).join(Product, Product.id == OrderItem.product_id)
        .where(*valid).group_by(Product.id, Product.name, Product.sku, Product.stock_quantity)
        .order_by(desc('units'), Product.id).limit(50)).all()
    stock_scope = [Product.category_id == category_id] if category_id else []
    stock_values = db.execute(select(
        func.coalesce(func.sum(case((Product.stock_quantity > 5, 1), else_=0)), 0),
        func.coalesce(func.sum(case(((Product.stock_quantity > 0) & (Product.stock_quantity <= 5), 1), else_=0)), 0),
        func.coalesce(func.sum(case((Product.stock_quantity <= 0, 1), else_=0)), 0),
        func.coalesce(func.sum(case((Product.stock_quantity > 0, Product.stock_quantity), else_=0)), 0),
    ).where(*stock_scope)).one()
    stock = dict(zip(['in_stock', 'low_stock', 'out_of_stock', 'total_units'], stock_values))
    sold_ids = select(OrderItem.product_id).join(Order).where(*valid)
    without_sales = db.scalar(select(func.count(Product.id)).where(*stock_scope, Product.id.notin_(sold_ids))) or 0
    critical = db.execute(select(Product.id, Product.name, Product.sku, Product.stock_quantity)
        .where(*stock_scope, Product.stock_quantity <= 5)
        .order_by(Product.stock_quantity, Product.id).limit(50)).all()

    # Operational snapshot: recent stock-ledger sales inform the run rate; lead time
    # is not stored yet, so this reports cover and the existing <=5 stock threshold
    # without pretending to calculate a supplier-specific reorder point.
    sales_since = datetime.now(timezone.utc) - timedelta(days=30)
    movement_rows = db.execute(select(
        Product.id, Product.name, Product.sku, Product.stock_quantity,
        func.coalesce(func.sum(func.abs(StockMovement.quantity_delta)), 0),
    ).select_from(Product).outerjoin(StockMovement, and_(
        StockMovement.product_id == Product.id,
        StockMovement.movement_type == MovementType.SALE,
        StockMovement.created_at >= sales_since,
    )).where(Product.status == ProductStatus.ACTIVE, *stock_scope)
      .group_by(Product.id, Product.name, Product.sku, Product.stock_quantity)
      .order_by(Product.stock_quantity, Product.name).limit(500)).all()
    procurement = []
    for id_, name, sku, stock_count, sold_30d in movement_rows:
        sold_count = int(sold_30d or 0)
        if stock_count > 5 and sold_count == 0:
            continue
        daily_rate = Decimal(sold_count) / Decimal(30)
        days_cover = (Decimal(stock_count) / daily_rate).quantize(Decimal('0.1')) if daily_rate else None
        procurement.append({
            'id': id_, 'name': name, 'sku': sku, 'stock': stock_count,
            'sold_30d': sold_count, 'daily_rate': daily_rate.quantize(Decimal('0.01')),
            'days_cover': days_cover,
        })
    procurement.sort(key=lambda row: (row['days_cover'] if row['days_cover'] is not None else Decimal('Infinity'), row['stock']))
    procurement = procurement[:50]
    sale_exists = exists(select(StockMovement.id).where(
        StockMovement.product_id == Product.id,
        StockMovement.movement_type == MovementType.SALE,
        StockMovement.created_at >= sales_since,
    ))
    slow_rows = db.execute(select(Product.id, Product.name, Product.sku, Product.stock_quantity)
        .where(Product.status == ProductStatus.ACTIVE, Product.stock_quantity > 5,
               *stock_scope, ~sale_exists)
        .order_by(Product.stock_quantity.desc(), Product.name).limit(50)).all()
    slow_movers = [
        {'id': id_, 'name': name, 'sku': sku, 'stock': stock_count,
         'sold_30d': 0, 'daily_rate': Decimal(0), 'days_cover': None}
        for id_, name, sku, stock_count in slow_rows
    ]

    now = datetime.now(timezone.utc)
    idle_before = now - timedelta(hours=48)
    open_statuses = [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT, OrderStatus.CONFIRMED,
                     OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
    idle_rows = db.execute(select(Order.id, Order.number, Order.status, Order.updated_at)
        .where(Order.status.in_(open_statuses), Order.updated_at < idle_before)
        .order_by(Order.updated_at.asc()).limit(20)).all()
    stale_orders = [StaleOrderSignal(
        id=id_, number=number, status=status.value, updated_at=updated_at,
        idle_hours=max(48, int((now - updated_at).total_seconds() // 3600)),
    ) for id_, number, status, updated_at in idle_rows]
    cohort = [*scope, Order.created_at >= start, Order.created_at < end]
    reached = db.execute(select(OrderStatusHistory.to_status, func.count(distinct(Order.id)))
        .select_from(OrderStatusHistory).join(Order).where(*cohort)
        .group_by(OrderStatusHistory.to_status)).all()
    # First recorded entry into each stage; never infer stages from current state.
    first_events = select(OrderStatusHistory.order_id, OrderStatusHistory.to_status,
                          func.min(OrderStatusHistory.created_at).label('entered_at')).join(Order).where(*cohort)
    first_events = first_events.group_by(OrderStatusHistory.order_id, OrderStatusHistory.to_status).subquery()
    elapsed = ((func.julianday(first_events.c.entered_at) - func.julianday(Order.created_at)) * 24
               if db.get_bind().dialect.name == 'sqlite' else
               func.extract('epoch', first_events.c.entered_at - Order.created_at) / 3600)
    timings = db.execute(select(first_events.c.to_status, func.avg(elapsed))
        .select_from(Order).join(first_events, first_events.c.order_id == Order.id)
        .where(*cohort, first_events.c.entered_at >= Order.created_at)
        .group_by(first_events.c.to_status)).all()
    statuses = db.execute(select(Order.status, func.count(Order.id))
        .where(*scope, Order.created_at >= start, Order.created_at < end).group_by(Order.status)).all()
    reason_rows = db.execute(select(OrderStatusHistory.to_status, OrderStatusHistory.note)
        .select_from(OrderStatusHistory).join(Order)
        .where(*cohort, OrderStatusHistory.to_status.in_([OrderStatus.CANCELLED, OrderStatus.RETURNED]))).all()
    reason_counts: dict[OrderStatus, dict[str, int]] = {OrderStatus.CANCELLED: {}, OrderStatus.RETURNED: {}}
    for status, note in reason_rows:
        reason = (note.removeprefix('Причина: ').split(' · ', 1)[0]
                  if note and note.startswith('Причина: ') else 'Причина не указана')
        reason_counts[status][reason] = reason_counts[status].get(reason, 0) + 1
    return AnalyticsReport(
        start_date=start_date, end_date=end_date,
        previous_start_date=previous_start_date, previous_end_date=previous_end_date,
        timezone=timezone_name, grain=grain, comparison=comparison, category_id=category_id,
        demo_orders_in_period=demo_orders_in_period, demo_gross_profit=demo_gross_profit,
        current=summary(start, end), previous=summary(previous_start, previous_end), series=list(points.values()),
        categories=segments(Category, Product.category_id), brands=segments(Brand, Product.brand_id),
        products=[ReportProduct(id=id_, name=name, sku=sku, stock=stock_, units=units, item_value=value)
                  for id_, name, sku, stock_, units, value in product_rows],
        statuses=[ReportStatus(status=status.value, count=count) for status, count in statuses], stock=stock,
        cancellation_reasons=[ReasonCount(reason=reason, count=count) for reason, count in sorted(reason_counts[OrderStatus.CANCELLED].items(), key=lambda item: (-item[1], item[0]))],
        return_reasons=[ReasonCount(reason=reason, count=count) for reason, count in sorted(reason_counts[OrderStatus.RETURNED].items(), key=lambda item: (-item[1], item[0]))],
        reached_stages=[ReportStatus(status=status.value, count=count) for status, count in reached],
        processing_hours={status.value: round(float(hours), 2) for status, hours in timings if hours is not None},
        low_stock_products=[ReportProduct(id=id_, name=name, sku=sku, stock=stock_, units=0, item_value=0)
                            for id_, name, sku, stock_ in critical],
        procurement_signals=procurement,
        slow_movers=slow_movers,
        stale_orders=stale_orders,
        products_without_sales=without_sales,
        unavailable={
            'settled_revenue': 'Нет реестра подтверждённых платежей. Стоимость заказов не равна поступлениям.',
            'profit': 'Себестоимость и операционные расходы не хранятся; прибыль и маржа недоступны.',
            'marketing': 'Нет событий посещений и атрибуции каналов; конверсия недоступна.',
            'ltv': 'Нет полной истории поступлений и затрат для достоверного LTV.',
            'turnover': 'Нет исторических снимков среднего запаса и себестоимости.',
            'return_reasons': 'Причины фиксируются только для новых отмен и возвратов; старые записи могут быть без причины.',
            'supplier_lead_time': 'Срок поставки поставщика не хранится; запас в днях не является точкой заказа.',
        },
    )
