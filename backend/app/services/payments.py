"""Provider boundary. Order workflow status must never act as proof of payment.

A real adapter must verify signatures, persist idempotent provider events and
reconcile amounts/currency in a transaction before exposing a settled status.
No payment-success endpoint or simulated provider is supplied here.
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Mapping, Protocol
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel

from app.models.commerce import Order, OrderStatus, PaymentMethod


@dataclass(frozen=True)
class PaymentIntent:
    order_id: UUID
    amount: Decimal
    currency: str
    idempotency_key: str


@dataclass(frozen=True)
class ProviderCheckout:
    provider_reference: str
    redirect_url: str


class PaymentProvider(Protocol):
    def create_checkout(self, intent: PaymentIntent) -> ProviderCheckout: ...

    def verify_webhook(self, payload: bytes, headers: Mapping[str, str]) -> None: ...


class UnconfiguredProvider:
    def create_checkout(self, intent: PaymentIntent) -> ProviderCheckout:
        raise HTTPException(status_code=503, detail='Онлайн-оплата пока не подключена.')

    def verify_webhook(self, payload: bytes, headers: Mapping[str, str]) -> None:
        raise HTTPException(status_code=503, detail='Платёжный провайдер не подключён.')


class PaymentState(BaseModel):
    order_id: UUID
    method: PaymentMethod
    verification_status: str = 'unverified'
    online_payment_available: bool = False
    message: str


def payment_state(order: Order) -> PaymentState:
    if order.status in {OrderStatus.CANCELLED, OrderStatus.RETURNED}:
        message = 'Заказ отменён или возвращён. Статус перевода или возврата денег уточните у поддержки.'
    elif order.payment_method == PaymentMethod.CASH_ON_DELIVERY:
        message = 'Оплата при получении. Подтверждение поступления денег в системе отсутствует.'
    else:
        message = ('Банковский перевод требует ручной проверки. '
                   'Уточните реквизиты у поддержки; онлайн-оплата не подключена.')
    return PaymentState(order_id=order.id, method=order.payment_method, message=message)
