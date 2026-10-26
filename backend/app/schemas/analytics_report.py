from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class ReportSummary(BaseModel):
    order_value: Decimal
    orders: int
    valid_orders: int
    average_order_value: Decimal
    buyers: int
    repeat_buyers: int
    units: int
    discounts: Decimal
    shipping: Decimal
    cancelled: int
    returned: int
    returned_order_value: Decimal


class ReportPoint(BaseModel):
    date: date
    order_value: Decimal
    previous_order_value: Decimal
    orders: int


class ReportSegment(BaseModel):
    id: UUID
    name: str
    units: int
    item_value: Decimal


class ReportProduct(ReportSegment):
    sku: str
    stock: int


class ReportStatus(BaseModel):
    status: str
    count: int


class AnalyticsReport(BaseModel):
    start_date: date
    end_date: date
    previous_start_date: date
    previous_end_date: date
    timezone: str
    grain: Literal['day', 'week', 'month']
    currency: str = 'TJS'
    category_id: UUID | None
    current: ReportSummary
    previous: ReportSummary
    series: list[ReportPoint]
    categories: list[ReportSegment]
    brands: list[ReportSegment]
    products: list[ReportProduct]
    statuses: list[ReportStatus]
    reached_stages: list[ReportStatus]
    processing_hours: dict[str, float | None]
    low_stock_products: list[ReportProduct]
    products_without_sales: int
    stock: dict[str, int]
    unavailable: dict[str, str]
