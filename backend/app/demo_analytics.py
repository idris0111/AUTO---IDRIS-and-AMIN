"""Create/remove clearly marked analytics demo orders in a development database.

Run ``python -m app.demo_analytics seed`` to create a reversible sample set, or
``python -m app.demo_analytics clear`` to remove only those demo rows.
"""

from __future__ import annotations

import argparse
import secrets
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.catalog import Product, ProductStatus
from app.models.commerce import (
    Order, OrderItem, OrderStatus, OrderStatusHistory, PaymentMethod, ShippingMethod,
)
from app.models.inventory import MovementType, StockMovement, Warehouse, WarehouseStock
from app.models.user import User, UserRole

MARKER = "[DEMO ANALYTICS]"
DEMO_EMAIL_PREFIX = "demo.analytics."
DEMO_MARGIN_RATE = Decimal("0.28")
UTC_PLUS_5 = timezone(timedelta(hours=5))

STATUS_PATHS = {
    OrderStatus.PENDING: [OrderStatus.PENDING],
    OrderStatus.AWAITING_PAYMENT: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT],
    OrderStatus.CONFIRMED: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
    OrderStatus.PROCESSING: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING],
    OrderStatus.PACKED: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED],
    OrderStatus.SHIPPED: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
                          OrderStatus.PACKED, OrderStatus.SHIPPED],
    OrderStatus.DELIVERED: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
                            OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    OrderStatus.COMPLETED: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
                            OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED,
                            OrderStatus.COMPLETED],
    OrderStatus.CANCELLED: [OrderStatus.PENDING, OrderStatus.CANCELLED],
    OrderStatus.RETURNED: [OrderStatus.PENDING, OrderStatus.CONFIRMED,
                           OrderStatus.DELIVERED, OrderStatus.RETURNED],
}

STATUS_CYCLE = [
    OrderStatus.COMPLETED, OrderStatus.DELIVERED, OrderStatus.SHIPPED,
    OrderStatus.PROCESSING, OrderStatus.PENDING, OrderStatus.CANCELLED,
    OrderStatus.RETURNED, OrderStatus.AWAITING_PAYMENT, OrderStatus.CONFIRMED,
    OrderStatus.PACKED, OrderStatus.PROCESSING, OrderStatus.COMPLETED,
]


def _last_year(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # February 29 in a leap year maps to February 28.
        return day.replace(year=day.year - 1, day=28)


def _demo_users(db: Session, first_order_date: date) -> list[User]:
    users: list[User] = []
    created_at = datetime.combine(first_order_date - timedelta(days=30), time(12), UTC_PLUS_5)
    for index in range(3):
        email = f"{DEMO_EMAIL_PREFIX}{index + 1:02d}@demo.invalid"
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email,
                password_hash=hash_password(secrets.token_urlsafe(32)),
                first_name=f"Demo{index + 1}",
                last_name="Buyer",
                role=UserRole.CUSTOMER,
                created_at=created_at,
            )
            db.add(user)
            db.flush()
        elif user.role != UserRole.CUSTOMER:
            raise RuntimeError(f"Reserved demo email {email} belongs to a non-customer account")
        users.append(user)
    return users


def _next_product(products: list[Product], remaining: dict, preferred_index: int, quantity: int) -> tuple[Product, int]:
    for offset in range(len(products)):
        product = products[(preferred_index + offset) % len(products)]
        available = remaining[product.id]
        if available > 0:
            return product, min(quantity, available)
    raise RuntimeError("No sellable stock remains for the demo orders")


def seed_demo_orders(db: Session) -> int:
    if db.scalar(select(func.count(Order.id)).where(Order.customer_note.like(f"{MARKER}%"))):
        raise RuntimeError("Demo analytics rows already exist; clear them before reseeding")

    products = list(db.scalars(select(Product).where(
        Product.status == ProductStatus.ACTIVE, Product.stock_quantity > 0
    ).order_by(Product.sku)))
    warehouse = db.scalar(select(Warehouse).where(Warehouse.is_active.is_(True), Warehouse.is_default.is_(True)))
    if warehouse is None:
        warehouse = db.scalar(select(Warehouse).where(Warehouse.is_active.is_(True)).order_by(Warehouse.code))
    if not products or warehouse is None:
        raise RuntimeError("Seed active products and an active warehouse before demo analytics")

    stock_rows = {
        row.product_id: row
        for row in db.scalars(select(WarehouseStock).where(WarehouseStock.warehouse_id == warehouse.id))
    }
    if any(product.id not in stock_rows for product in products):
        raise RuntimeError("Every active demo product must have a stock row in the selected warehouse")

    now = datetime.now(timezone.utc)
    today_local = now.astimezone(UTC_PLUS_5).date()
    users = _demo_users(db, today_local - timedelta(days=89))
    remaining = {product.id: min(product.stock_quantity, stock_rows[product.id].quantity)
                 for product in products}
    number = 0

    for index in range(30):
        current_day = today_local - timedelta(days=index * 3)
        for sample_day in (current_day, _last_year(current_day)):
            status = STATUS_CYCLE[index % len(STATUS_CYCLE)]
            user = users[index % len(users)]
            product, quantity = _next_product(products, remaining, index * 5, 1 + (index % 3 == 0))
            unit_price = Decimal(product.price)
            line_total = (unit_price * quantity).quantize(Decimal("0.01"))
            subtotal = line_total
            discount = (subtotal * Decimal("0.05")).quantize(Decimal("0.01")) if index % 5 == 0 else Decimal("0")
            shipping_method = ShippingMethod.PICKUP if index % 3 == 0 else ShippingMethod.COURIER
            shipping_cost = Decimal("0") if shipping_method == ShippingMethod.PICKUP else Decimal("30.00")
            total = subtotal + shipping_cost - discount

            order_created = datetime.combine(sample_day, time(9), UTC_PLUS_5).astimezone(timezone.utc)
            stalled = sample_day == current_day and index in {3, 10}
            activity_at = min(now, order_created + timedelta(hours=18))
            if stalled:
                activity_at = min(now - timedelta(hours=72), max(order_created, now - timedelta(days=3)))

            number += 1
            order = Order(
                number=f"DEMO-AN-{today_local:%y%m%d}-{number:03d}",
                user_id=user.id,
                status=status,
                shipping_method=shipping_method,
                payment_method=PaymentMethod.BANK_TRANSFER if index % 2 else PaymentMethod.CASH_ON_DELIVERY,
                subtotal=subtotal,
                shipping_cost=shipping_cost,
                discount=discount,
                points_discount=Decimal("0"),
                total=total,
                currency="TJS",
                contact_name=f"Demo Buyer {index % len(users) + 1}",
                contact_phone=f"+992900000{index % len(users) + 1:03d}",
                contact_email=user.email,
                shipping_city="Душанбе",
                shipping_street="Демо-данные, не доставлять",
                customer_note=f"{MARKER} Temporary sample only. Remove with: python -m app.demo_analytics clear",
                created_at=order_created,
                updated_at=activity_at,
            )
            db.add(order)
            db.flush()
            db.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                product_sku=product.sku,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            ))

            path = STATUS_PATHS[status]
            elapsed = max(0.0, (activity_at - order_created).total_seconds())
            for step, to_status in enumerate(path):
                event_at = order_created + timedelta(seconds=elapsed * step / max(1, len(path) - 1))
                reason = None
                if to_status == OrderStatus.CANCELLED:
                    reason = "Причина: Покупатель отменил заказ"
                elif to_status == OrderStatus.RETURNED:
                    reason = "Причина: Дефект или повреждение"
                db.add(OrderStatusHistory(
                    order_id=order.id,
                    from_status=path[step - 1] if step else None,
                    to_status=to_status,
                    note=reason,
                    created_at=event_at,
                ))

            if status not in {OrderStatus.CANCELLED, OrderStatus.RETURNED}:
                remaining[product.id] -= quantity
                stock = stock_rows[product.id]
                stock.quantity -= quantity
                product.stock_quantity -= quantity
                db.add(StockMovement(
                    product_id=product.id,
                    warehouse_id=warehouse.id,
                    movement_type=MovementType.SALE,
                    quantity_delta=-quantity,
                    balance_after=stock.quantity,
                    order_id=order.id,
                    user_id=user.id,
                    reason=f"{MARKER} sample sale; reversible with demo analytics cleanup",
                    created_at=order_created,
                ))

    return number


def clear_demo_orders(db: Session) -> int:
    orders = list(db.scalars(select(Order).where(Order.customer_note.like(f"{MARKER}%"))))
    order_ids = [order.id for order in orders]
    if not order_ids:
        return 0

    movements = list(db.scalars(select(StockMovement).where(StockMovement.order_id.in_(order_ids))))
    for movement in movements:
        if movement.movement_type == MovementType.SALE and movement.quantity_delta < 0:
            quantity = -movement.quantity_delta
            stock = db.scalar(select(WarehouseStock).where(
                WarehouseStock.product_id == movement.product_id,
                WarehouseStock.warehouse_id == movement.warehouse_id,
            ))
            product = db.get(Product, movement.product_id)
            if stock is not None:
                stock.quantity += quantity
            if product is not None:
                product.stock_quantity += quantity
        db.delete(movement)

    for order in orders:
        db.delete(order)
    db.flush()

    demo_users = list(db.scalars(select(User).where(User.email.like(f"{DEMO_EMAIL_PREFIX}%@demo.invalid"))))
    for user in demo_users:
        if not db.scalar(select(Order.id).where(Order.user_id == user.id).limit(1)):
            db.delete(user)
    return len(orders)


def main() -> None:
    parser = argparse.ArgumentParser(description="Temporary, reversible demo analytics data")
    parser.add_argument("action", choices=("seed", "clear"))
    args = parser.parse_args()
    if get_settings().app_env != "development":
        raise SystemExit("Demo analytics data can only be used when APP_ENV=development")

    with SessionLocal() as db:
        try:
            with db.begin():
                count = seed_demo_orders(db) if args.action == "seed" else clear_demo_orders(db)
            verb = "Created" if args.action == "seed" else "Removed"
            print(f"{verb} {count} temporary demo orders")
        except Exception:
            db.rollback()
            raise


if __name__ == "__main__":
    main()
