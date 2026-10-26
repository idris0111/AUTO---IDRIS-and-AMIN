export interface ReportSummary {
  order_value: string; orders: number; valid_orders: number; average_order_value: string
  buyers: number; repeat_buyers: number; units: number; discounts: string; shipping: string
  cancelled: number; returned: number; returned_order_value: string
}
export interface ReportSegment { id: string; name: string; units: number; item_value: string }
export interface AnalyticsReport {
  start_date: string; end_date: string; previous_start_date: string; previous_end_date: string
  timezone: string; grain: 'day' | 'week' | 'month'; comparison: 'previous_period' | 'previous_year'; currency: string
  demo_orders_in_period: number; demo_gross_profit: string; category_id: string | null
  current: ReportSummary; previous: ReportSummary
  series: { date: string; order_value: string; previous_order_value: string; orders: number }[]
  categories: ReportSegment[]; brands: ReportSegment[]
  products: (ReportSegment & { sku: string; stock: number })[]
  procurement_signals: { id: string; name: string; sku: string; stock: number; sold_30d: number; daily_rate: string; days_cover: string | null }[]
  slow_movers: { id: string; name: string; sku: string; stock: number; sold_30d: number; daily_rate: string; days_cover: string | null }[]
  stale_orders: { id: string; number: string; status: string; updated_at: string; idle_hours: number }[]
  statuses: { status: string; count: number }[]
  cancellation_reasons: { reason: string; count: number }[]
  return_reasons: { reason: string; count: number }[]
  reached_stages: { status: string; count: number }[]
  processing_hours: Record<string, number | null>
  low_stock_products: (ReportSegment & { sku: string; stock: number })[]
  products_without_sales: number
  stock: { in_stock: number; low_stock: number; out_of_stock: number; total_units: number }
  unavailable: Record<string, string>
}
