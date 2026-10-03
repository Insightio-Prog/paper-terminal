import { summarizeLedgerPeriod } from '../lib/ledgerPeriods'
import { formatPence, parsePoundsToPence } from '../lib/money'
import { dateToTaxYear } from '../lib/taxYear'
import { useContactStore } from '../stores/contactStore'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  computeTotals,
  selectFilteredEntries,
  useLedgerStore,
  type EntryType,
} from '../stores/ledgerStore'
import {
  buildDefaultInvoiceNotes,
  recalcInvoiceTotals,
  recalcLineItem,
  useInvoiceStore,
} from '../stores/invoiceStore'
import { useNavigationStore } from '../stores/navigationStore'

export interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export const claudeTools: AnthropicTool[] = [
  {
    name: 'add_ledger_entry',
    description:
      'Add a new income or expense entry to the business ledger for the current tax year.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Entry date in ISO format (YYYY-MM-DD).',
        },
        description: {
          type: 'string',
          description: 'Short description of the transaction.',
        },
        category: {
          type: 'string',
          description:
            'Category name. Must match an available category for the entry type. Call get_categories if unsure.',
        },
        amount: {
          type: 'number',
          description: 'Amount in pounds (e.g. 14.99 for £14.99).',
        },
        type: {
          type: 'string',
          enum: ['in', 'out'],
          description: "Entry type: 'in' for income, 'out' for expense.",
        },
      },
      required: ['date', 'description', 'category', 'amount', 'type'],
    },
  },
  {
    name: 'get_ledger_summary',
    description:
      'Get full-tax-year headline ledger totals and tax estimate for the selected tax year. For questions about a specific recent period (this month, last month, last quarter), use get_ledger_breakdown instead.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_ledger_breakdown',
    description:
      'Get income and expense totals for a specific recent period (this month, last month, or last quarter) — not scoped to the full tax year. Use for questions about a recent time period rather than year-to-date totals. Optionally filter to a single ledger category (e.g. Software Subscriptions).',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_month', 'last_quarter'],
          description:
            "Period to total: 'this_month' (1st of the current month through today), 'last_month' (full previous calendar month), or 'last_quarter' (full previous calendar quarter).",
        },
        category: {
          type: 'string',
          description:
            'Optional ledger category to filter by. Call get_categories first if unsure of the exact name, and pass it exactly as returned (case-sensitive).',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_categories',
    description:
      'Get available income and expense categories for ledger entries.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_invoice',
    description:
      'Create a new draft invoice for a client. Use when the user asks to raise, create, or send an invoice.',
    input_schema: {
      type: 'object',
      properties: {
        client_name: {
          type: 'string',
          description: 'Name of the client.',
        },
        client_company: {
          type: 'string',
          description: 'Client company, if known.',
        },
        client_email: {
          type: 'string',
          description: 'Client email, if known.',
        },
        client_address: {
          type: 'string',
          description: 'Client address, if known.',
        },
        line_items: {
          type: 'array',
          description: 'Invoice line items.',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Line item description.',
              },
              quantity: {
                type: 'number',
                description: 'Quantity. Defaults to 1.',
              },
              unit_price: {
                type: 'number',
                description: 'Unit price in pounds (e.g. 250 for £250.00).',
              },
            },
            required: ['description', 'unit_price'],
          },
        },
        notes: {
          type: 'string',
          description: 'Optional notes or payment terms override.',
        },
        due_days: {
          type: 'number',
          description: 'Days until payment due. Defaults to 30.',
        },
      },
      required: ['client_name', 'line_items'],
    },
  },
  {
    name: 'add_contact',
    description:
      'Add a new contact to the CRM. Only name is required; other fields are optional.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact name. Required.' },
        company: { type: 'string', description: 'Company, if mentioned.' },
        email: { type: 'string', description: 'Email, if mentioned.' },
        phone: { type: 'string', description: 'Phone, if mentioned.' },
        address: { type: 'string', description: 'Address, if mentioned.' },
        notes: { type: 'string', description: 'Freeform notes, if mentioned.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_contacts',
    description:
      'List contacts in the CRM. Use when the user asks about clients or contacts.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

function isEntryType(value: unknown): value is EntryType {
  return value === 'in' || value === 'out'
}

function poundsToPence(amount: unknown): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null
  }
  // Number from Claude JSON → fixed 2dp string → integer pence (no float * 100).
  const pence = parsePoundsToPence(amount.toFixed(2))
  if (pence === null || pence <= 0) {
    // Unusual: finite amount > 0 should always parse after toFixed(2).
    console.warn(
      '[tools] poundsToPence: unparseable or sub-penny amount from Claude',
      amount,
    )
    return null
  }
  return pence
}

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

type BreakdownPeriod = 'this_month' | 'last_month' | 'last_quarter'

function toIsoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function periodDateRange(period: BreakdownPeriod): {
  start: string
  end: string
  label: string
} {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  if (period === 'this_month') {
    return {
      start: toIsoLocal(new Date(year, month, 1)),
      end: toIsoLocal(now),
      label: 'This month',
    }
  }

  if (period === 'last_month') {
    const lastMonthYear = month === 0 ? year - 1 : year
    const lastMonth = month === 0 ? 11 : month - 1
    const endDay = new Date(lastMonthYear, lastMonth + 1, 0).getDate()
    return {
      start: toIsoLocal(new Date(lastMonthYear, lastMonth, 1)),
      end: toIsoLocal(new Date(lastMonthYear, lastMonth, endDay)),
      label: 'Last month',
    }
  }

  const currentQuarter = Math.floor(month / 3)
  const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
  const prevYear = currentQuarter === 0 ? year - 1 : year
  const startMonth = prevQuarter * 3
  const endMonth = startMonth + 2
  const endDay = new Date(prevYear, endMonth + 1, 0).getDate()
  return {
    start: toIsoLocal(new Date(prevYear, startMonth, 1)),
    end: toIsoLocal(new Date(prevYear, endMonth, endDay)),
    label: 'Last quarter',
  }
}

function toNullable(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function executeAddLedgerEntry(
  input: Record<string, unknown>,
): Promise<string> {
  const date = typeof input.date === 'string' ? input.date : ''
  const description =
    typeof input.description === 'string' ? input.description.trim() : ''
  const category = typeof input.category === 'string' ? input.category : ''
  const type = input.type
  const pence = poundsToPence(input.amount)

  if (!date || !description || !category || !isEntryType(type) || pence === null) {
    return 'Error: Invalid entry fields. Need date, description, category, amount (pounds > 0), and type (in/out).'
  }

  const allowed = type === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  if (!(allowed as readonly string[]).includes(category)) {
    return `Error: Invalid category "${category}" for ${type}. Valid options: ${allowed.join(', ')}.`
  }

  await useLedgerStore.getState().addEntry({
    date,
    description,
    category,
    amount: pence,
    type,
  })

  return `Entry added — ${description} (${type}, ${formatPence(pence)}).`
}

function executeGetLedgerSummary(): string {
  const { entries, taxYear } = useLedgerStore.getState()
  const filtered = selectFilteredEntries(entries, taxYear)
  const totals = computeTotals(filtered)
  const tax = totals.tax

  return [
    `Tax year ${taxYear}:`,
    `Income ${formatPence(totals.totalIncome)}, expenses ${formatPence(totals.totalExpenses)}, net ${formatPence(totals.netProfit)}.`,
    `Self Assessment owed ${formatPence(Math.max(0, tax.selfAssessmentOwed))}, total liability ${formatPence(tax.totalLiability)}, PAYE credit ${formatPence(tax.payeTaxCredit)}.`,
    `${filtered.length} entries.`,
  ].join(' ')
}

function executeGetLedgerBreakdown(input: Record<string, unknown>): string {
  const period = input.period
  if (
    period !== 'this_month' &&
    period !== 'last_month' &&
    period !== 'last_quarter'
  ) {
    return 'Error: period must be this_month, last_month, or last_quarter.'
  }

  const categoryRaw =
    typeof input.category === 'string' ? input.category.trim() : ''
  const category = categoryRaw === '' ? undefined : categoryRaw

  // Same exact-match convention as add_ledger_entry / get_categories (no normalisation).
  const knownCategories: readonly string[] = [
    ...INCOME_CATEGORIES,
    ...EXPENSE_CATEGORIES,
  ]

  const range = periodDateRange(period)
  const startTaxYear = dateToTaxYear(range.start)
  const endTaxYear = dateToTaxYear(range.end)
  const taxYearNote =
    startTaxYear === endTaxYear
      ? `Tax year ${startTaxYear}.`
      : `Spans tax years ${startTaxYear} and ${endTaxYear}.`

  if (category !== undefined && !knownCategories.includes(category)) {
    return [
      `${range.label} (${range.start} to ${range.end}):`,
      `Category filter: ${category}.`,
      `No known category matching "${category}" (pass the exact name from get_categories).`,
      `Income ${formatPence(0)}, expenses ${formatPence(0)}, net ${formatPence(0)}.`,
      `0 entries.`,
      taxYearNote,
    ].join(' ')
  }

  const entries = useLedgerStore.getState().entries
  const { filtered, income, expenses, net } = summarizeLedgerPeriod(
    entries,
    range.start,
    range.end,
    category,
  )

  return [
    `${range.label} (${range.start} to ${range.end}):`,
    ...(category !== undefined ? [`Category filter: ${category}.`] : []),
    `Income ${formatPence(income)}, expenses ${formatPence(expenses)}, net ${formatPence(net)}.`,
    `${filtered.length} entries.`,
    taxYearNote,
  ].join(' ')
}

function executeGetCategories(): string {
  return [
    `Income categories: ${INCOME_CATEGORIES.join(', ')}.`,
    `Expense categories: ${EXPENSE_CATEGORIES.join(', ')}.`,
  ].join(' ')
}

async function executeCreateInvoice(
  input: Record<string, unknown>,
): Promise<string> {
  const clientName =
    typeof input.client_name === 'string' ? input.client_name.trim() : ''
  if (!clientName) {
    return 'Error: client_name is required.'
  }

  const rawItems = Array.isArray(input.line_items) ? input.line_items : []
  if (rawItems.length === 0) {
    return 'Error: At least one line item is required.'
  }

  const lineItems = []
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') {
      return 'Error: Invalid line item.'
    }
    const item = raw as Record<string, unknown>
    const description =
      typeof item.description === 'string' ? item.description.trim() : ''
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity)
        ? item.quantity
        : 1
    const unitPence = poundsToPence(item.unit_price)

    if (!description || unitPence === null) {
      return 'Error: Each line item needs description and unit_price in pounds (> 0).'
    }

    lineItems.push(
      recalcLineItem({
        id: crypto.randomUUID(),
        description,
        quantity,
        unit_price: unitPence,
        amount: 0,
      }),
    )
  }

  const totals = recalcInvoiceTotals(lineItems)
  const issueDate = todayIso()
  const dueDays =
    typeof input.due_days === 'number' && Number.isFinite(input.due_days)
      ? Math.max(0, Math.floor(input.due_days))
      : 30
  const notes =
    typeof input.notes === 'string' && input.notes.trim()
      ? input.notes.trim()
      : buildDefaultInvoiceNotes()

  const invoice = await useInvoiceStore.getState().createInvoice({
    client_name: clientName,
    client_company:
      typeof input.client_company === 'string' ? input.client_company.trim() : '',
    client_email:
      typeof input.client_email === 'string' ? input.client_email.trim() : '',
    client_address:
      typeof input.client_address === 'string' ? input.client_address.trim() : '',
    issue_date: issueDate,
    due_date: addDays(issueDate, dueDays),
    line_items: lineItems,
    subtotal: totals.subtotal,
    total: totals.total,
    status: 'draft',
    notes,
    payment_terms: '',
  })

  useInvoiceStore.getState().setActiveInvoice(invoice)
  useNavigationStore.getState().setActiveView('invoicing')

  return `Invoice ${invoice.invoice_number} created for ${clientName} — ${formatPence(invoice.total)}. Opening now.`
}

async function executeAddContact(
  input: Record<string, unknown>,
): Promise<string> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) {
    return 'Error: Contact name is required.'
  }

  await useContactStore.getState().addContact({
    name,
    company: toNullable(input.company),
    email: toNullable(input.email),
    phone: toNullable(input.phone),
    address: toNullable(input.address),
    notes: toNullable(input.notes),
  })

  return `Contact added — ${name}.`
}

async function executeGetContacts(): Promise<string> {
  await useContactStore.getState().loadContacts()
  const contacts = useContactStore.getState().contacts

  if (contacts.length === 0) {
    return 'No contacts in CRM yet.'
  }

  const lines = contacts.map((contact) => {
    const bits = [contact.name]
    if (contact.company) bits.push(contact.company)
    if (contact.email) bits.push(contact.email)
    return bits.join(' — ')
  })

  return `${contacts.length} contact(s):\n${lines.join('\n')}`
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'add_ledger_entry':
      return executeAddLedgerEntry(input)
    case 'get_ledger_summary':
      return executeGetLedgerSummary()
    case 'get_ledger_breakdown':
      return executeGetLedgerBreakdown(input)
    case 'get_categories':
      return executeGetCategories()
    case 'create_invoice':
      return executeCreateInvoice(input)
    case 'add_contact':
      return executeAddContact(input)
    case 'get_contacts':
      return executeGetContacts()
    default:
      return `Error: Unknown tool "${name}".`
  }
}
