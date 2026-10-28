from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


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


class ProcurementSignal(BaseModel):
    id: UUID
    name: str
    sku: str
    stock: int
    sold_30d: int
    daily_rate: Decimal
    days_cover: Decimal | None


class StaleOrderSignal(BaseModel):
    id: UUID
    number: str
    status: str
    updated_at: datetime
    idle_hours: int


class ReportStatus(BaseModel):
    status: str
    count: int


class ReasonCount(BaseModel):
    reason: str
    count: int


class AnalyticsReport(BaseModel):
    start_date: date
    end_date: date
    previous_start_date: date
    previous_end_date: date
    timezone: str
    grain: Literal['day', 'week', 'month']
    comparison: Literal['previous_period', 'previous_year'] = 'previous_period'
    currency: str = 'TJS'
    demo_orders_in_period: int = 0
    demo_gross_profit: Decimal = Decimal('0')
    category_id: UUID | None
    current: ReportSummary
    previous: ReportSummary
    series: list[ReportPoint]
    categories: list[ReportSegment]
    brands: list[ReportSegment]
    products: list[ReportProduct]
    statuses: list[ReportStatus]
    cancellation_reasons: list[ReasonCount] = Field(default_factory=list)
    return_reasons: list[ReasonCount] = Field(default_factory=list)
    reached_stages: list[ReportStatus]
    processing_hours: dict[str, float | None]
    low_stock_products: list[ReportProduct]
    procurement_signals: list[ProcurementSignal] = Field(default_factory=list)
    slow_movers: list[ProcurementSignal] = Field(default_factory=list)
    stale_orders: list[StaleOrderSignal] = Field(default_factory=list)
    products_without_sales: int
    stock: dict[str, int]
    unavailable: dict[str, str]
