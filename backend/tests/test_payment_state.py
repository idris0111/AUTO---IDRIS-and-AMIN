import pytest

from fastapi import HTTPException
from sqlalchemy import event

from app.models.commerce import OrderStatus
from app.services.analytics_report import get_report
from app.services.payments import PaymentIntent, UnconfiguredProvider
from tests.conftest import register_and_login
from tests.test_commerce import setup_admin_product
from datetime import date
from decimal import Decimal
from uuid import uuid4


def test_order_payment_is_honest_and_owner_scoped(client, db, user_payload):
    admin = setup_admin_product(client, db, user_payload, 'payment-admin@example.com')
    tokens = register_and_login(client, {**user_payload, 'email': 'payment-buyer@example.com'})
    headers = {'Authorization': f"Bearer {tokens['access_token']}"}
    client.post('/api/v1/cart/items', headers=headers,
                json={'product_id': admin['product']['id'], 'quantity': 1})
    response = client.post('/api/v1/orders/checkout', headers=headers, json={
        'contact_name': 'Payment Buyer', 'contact_phone': '+992900000000',
        'shipping_method': 'pickup', 'payment_method': 'bank_transfer',
        'shipping_city': 'Dushanbe', 'shipping_street': 'Test',
    })
    assert response.status_code == 201
    order_id = response.json()['id']
    path = f'/api/v1/orders/{order_id}/payment'
    assert client.get(path).status_code == 401
    assert client.get(path, headers=admin['headers']).status_code == 404
    payment = client.get(path, headers=headers)
    assert payment.status_code == 200
    assert payment.json()['verification_status'] == 'unverified'
    assert payment.json()['online_payment_available'] is False
    assert response.json()['status'] == OrderStatus.AWAITING_PAYMENT.value
    cancelled = client.post(f'/api/v1/orders/{order_id}/cancel', headers=headers)
    assert cancelled.status_code == 200
    assert client.get(path, headers=headers).json()['verification_status'] == 'unverified'
    provider = UnconfiguredProvider()
    intent = PaymentIntent(uuid4(), Decimal('45'), 'TJS', 'test-idempotency-key')
    with pytest.raises(HTTPException) as error:
        provider.create_checkout(intent)
    assert error.value.status_code == 503
    with pytest.raises(HTTPException) as error:
        provider.verify_webhook(b'{}', {})
    assert error.value.status_code == 503


def test_report_query_count_is_bounded(db):
    statements = []
    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    engine = db.get_bind()
    event.listen(engine, 'before_cursor_execute', record)
    try:
        report = get_report(db, date(2026, 1, 1), date(2026, 12, 31))
    finally:
        event.remove(engine, 'before_cursor_execute', record)
    assert len(report.series) == 365
    assert len(statements) <= 25
