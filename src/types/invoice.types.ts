export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string
  client_email: string
  client_address: string
  issue_date: string
  due_date: string
  line_items: LineItem[]
  subtotal: number
  total: number
  status: InvoiceStatus
  notes: string
  payment_terms: string
  created_at: string
  updated_at: string
}
