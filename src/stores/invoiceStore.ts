import { create } from 'zustand'
import { repositories } from '../lib/repository'
import { useLedgerStore } from './ledgerStore'
import { useProfileStore } from './profileStore'
import { reportStoreError } from './toastStore'
import type { Invoice, LineItem } from '../types/invoice.types'

export type InvoiceInput = Omit<
  Invoice,
  'id' | 'invoice_number' | 'created_at' | 'updated_at'
>

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function recalcLineItem(item: LineItem): LineItem {
  return {
    ...item,
    amount: Math.round(item.quantity * item.unit_price),
  }
}

export function recalcInvoiceTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  return { subtotal, total: subtotal }
}

export function buildDefaultInvoiceNotes(): string {
  const { default_payment_terms, default_notes } = useProfileStore.getState()
  return [default_payment_terms, default_notes].filter(Boolean).join('\n\n')
}

export function createDraftInvoice(): Invoice {
  const today = todayIso()
  const profile = useProfileStore.getState()

  return {
    id: '',
    invoice_number: '',
    client_name: '',
    client_company: '',
    client_email: '',
    client_address: '',
    issue_date: today,
    due_date: addDays(today, 30),
    line_items: [
      recalcLineItem({
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
      }),
    ],
    subtotal: 0,
    total: 0,
    status: 'draft',
    notes: buildDefaultInvoiceNotes(),
    payment_terms: profile.default_payment_terms ?? '',
    created_at: '',
    updated_at: '',
  }
}

interface InvoiceState {
  invoices: Invoice[]
  activeInvoice: Invoice | null
  loadInvoices: () => Promise<void>
  getNextInvoiceNumber: () => Promise<string>
  createInvoice: (data: InvoiceInput) => Promise<Invoice>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  setActiveInvoice: (invoice: Invoice | null) => void
  markAsSent: (id: string) => Promise<void>
  markAsPaid: (id: string) => Promise<void>
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  activeInvoice: null,

  loadInvoices: async () => {
    try {
      const rows = await repositories.invoices.list()

      const today = todayIso()
      const invoices: Invoice[] = []

      for (const invoice of rows) {
        if (
          invoice.status === 'sent' &&
          invoice.due_date &&
          invoice.due_date < today
        ) {
          try {
            await repositories.invoices.updateStatus(
              invoice.id,
              'overdue',
              new Date().toISOString(),
            )
            invoices.push({ ...invoice, status: 'overdue' })
          } catch (error) {
            console.error("Couldn't mark invoice overdue", error)
            invoices.push(invoice)
          }
        } else {
          invoices.push(invoice)
        }
      }

      set({ invoices })
    } catch (error) {
      reportStoreError("Couldn't load invoices", error)
    }
  },

  getNextInvoiceNumber: async () => {
    try {
      return await repositories.invoices.getNextInvoiceNumber()
    } catch (error) {
      reportStoreError("Couldn't get next invoice number", error)
      throw error
    }
  },

  createInvoice: async (data) => {
    try {
      const invoiceNumber = await repositories.invoices.getNextInvoiceNumber()
      const now = new Date().toISOString()
      const lineItems = data.line_items.map(recalcLineItem)
      const totals = recalcInvoiceTotals(lineItems)

      const invoice: Invoice = {
        ...data,
        id: crypto.randomUUID(),
        invoice_number: invoiceNumber,
        line_items: lineItems,
        subtotal: totals.subtotal,
        total: totals.total,
        created_at: now,
        updated_at: now,
      }

      await repositories.invoices.insert(invoice)
      await get().loadInvoices()
      return invoice
    } catch (error) {
      reportStoreError("Couldn't create invoice", error)
      throw error
    }
  },

  updateInvoice: async (id, updates) => {
    const current = get().invoices.find((invoice) => invoice.id === id)
    if (!current) return

    const lineItems = (updates.line_items ?? current.line_items).map(
      recalcLineItem,
    )
    const totals = recalcInvoiceTotals(lineItems)
    const next: Invoice = {
      ...current,
      ...updates,
      line_items: lineItems,
      subtotal: totals.subtotal,
      total: totals.total,
      updated_at: new Date().toISOString(),
    }

    try {
      await repositories.invoices.update(next)
      await get().loadInvoices()
    } catch (error) {
      reportStoreError('Invoice update failed', error)
      throw error
    }
  },

  deleteInvoice: async (id) => {
    try {
      await repositories.invoices.delete(id)
      await get().loadInvoices()
    } catch (error) {
      reportStoreError("Couldn't delete invoice", error)
      throw error
    }
  },

  setActiveInvoice: (invoice) => set({ activeInvoice: invoice }),

  markAsSent: async (id) => {
    await get().updateInvoice(id, { status: 'sent' })
  },

  markAsPaid: async (id) => {
    const invoice = get().invoices.find((item) => item.id === id)
    if (!invoice) return

    await get().updateInvoice(id, { status: 'paid' })

    await useLedgerStore.getState().addEntry({
      date: todayIso(),
      description: `Invoice ${invoice.invoice_number} — ${invoice.client_name}`,
      category: 'Invoice income',
      amount: invoice.total,
      type: 'in',
    })
  },
}))
