export interface ReportSummary {
  order_value: string; orders: number; valid_orders: number; average_order_value: string
  buyers: number; repeat_buyers: number; units: number; discounts: string; shipping: string
  cancelled: number; returned: number; returned_order_value: string
}
export interface ReportSegment { id: string; name: string; units: number; item_value: string }
export interface AnalyticsReport {
  start_date: string; end_date: string; previous_start_date: string; previous_end_date: string
  timezone: string; grain: 'day' | 'week' | 'month'; currency: string; category_id: string | null
  current: ReportSummary; previous: ReportSummary
  series: { date: string; order_value: string; previous_order_value: string; orders: number }[]
  categories: ReportSegment[]; brands: ReportSegment[]
  products: (ReportSegment & { sku: string; stock: number })[]
  statuses: { status: string; count: number }[]
  reached_stages: { status: string; count: number }[]
  processing_hours: Record<string, number | null>
  low_stock_products: (ReportSegment & { sku: string; stock: number })[]
  products_without_sales: number
  stock: { in_stock: number; low_stock: number; out_of_stock: number; total_units: number }
  unavailable: Record<string, string>
}
