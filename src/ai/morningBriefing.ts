import { sendCompletion } from './claude'
import { formatDeadlinesForBriefing } from '../lib/deadlines'
import {
  computeTotals,
  selectFilteredEntries,
  useLedgerStore,
} from '../stores/ledgerStore'
import { useInvoiceStore } from '../stores/invoiceStore'
import { useProfileStore } from '../stores/profileStore'
import type { Invoice } from '../types/invoice.types'
import type { LedgerEntry } from '../types/ledger.types'

export interface LedgerSummary {
  taxYear: string
  totalIncome: number
  totalExpenses: number
  netProfit: number
  selfAssessmentOwed: number
  totalTaxLiability: number
  payeTaxCredit: number
  employmentIncome: number
  selfEmploymentProfit: number
  entryCount: number
  lastEntryDate: string | null
  todayDate: string
}

export interface InvoiceSummary {
  overdueCount: number
  overdueTotal: number
  unpaidCount: number
  unpaidTotal: number
  draftCount: number
}

function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2)
}

export function formatTodayForBriefing(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function buildLedgerSummary(
  entries: LedgerEntry[],
  taxYear: string,
  todayDate: string,
  payeTaxPaid: number,
): LedgerSummary {
  const filtered = selectFilteredEntries(entries, taxYear)
  const totals = computeTotals(filtered, payeTaxPaid)
  const lastEntryDate =
    filtered.length === 0
      ? null
      : filtered.reduce(
          (latest, entry) => (entry.date > latest ? entry.date : latest),
          filtered[0].date,
        )

  return {
    taxYear,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    netProfit: totals.netProfit,
    selfAssessmentOwed: totals.tax.selfAssessmentOwed,
    totalTaxLiability: totals.tax.totalLiability,
    payeTaxCredit: totals.tax.payeTaxCredit,
    employmentIncome: totals.tax.employmentIncome,
    selfEmploymentProfit: totals.tax.selfEmploymentProfit,
    entryCount: filtered.length,
    lastEntryDate,
    todayDate,
  }
}

export function buildInvoiceSummary(invoices: Invoice[]): InvoiceSummary {
  let overdueCount = 0
  let overdueTotal = 0
  let unpaidCount = 0
  let unpaidTotal = 0
  let draftCount = 0

  for (const invoice of invoices) {
    if (invoice.status === 'overdue') {
      overdueCount += 1
      overdueTotal += invoice.total
    } else if (invoice.status === 'sent') {
      unpaidCount += 1
      unpaidTotal += invoice.total
    } else if (invoice.status === 'draft') {
      draftCount += 1
    }
  }

  return {
    overdueCount,
    overdueTotal,
    unpaidCount,
    unpaidTotal,
    draftCount,
  }
}

function buildSystemPrompt(summary: LedgerSummary, todayDisplay: string): string {
  return [
    'You are the Morning Briefing agent for Paper Terminal, a business suite for a UK sole trader.',
    `The current UK tax year is ${summary.taxYear}. Today's date is ${todayDisplay}.`,
    '',
    'Deliver a concise morning briefing in 3–5 short paragraphs maximum.',
    'Cover: a financial snapshot for the current tax year, any observations worth flagging from the data, upcoming UK tax deadlines relevant to a sole trader, invoice status where relevant, and tax position where relevant.',
    'Upcoming deadlines, invoice status, and tax position are provided below — weave the most relevant details into your prose, especially URGENT deadlines, overdue invoices, and the Self Assessment owed figure when it is non-zero. Do not list them robotically.',
    '',
    'Tone: warm, direct, professional — like a smart accountant friend, not a corporate chatbot. A light touch of personality is fine.',
    '',
    'You must NOT use markdown. Plain text only — no bullet points, no headers, no asterisks. Flowing prose paragraphs only, separated by blank lines.',
    'End with one specific actionable nudge if anything warrants attention, otherwise a brief closing line.',
  ].join('\n')
}

function formatInvoiceSection(summary: InvoiceSummary): string {
  const allZero =
    summary.overdueCount === 0 &&
    summary.unpaidCount === 0 &&
    summary.draftCount === 0

  if (allZero) {
    return 'INVOICE STATUS: No active invoices.'
  }

  const lines = ['INVOICE STATUS:', '']

  if (summary.overdueCount > 0) {
    const label = summary.overdueCount === 1 ? 'invoice' : 'invoices'
    lines.push(
      `Overdue: ${summary.overdueCount} ${label} totalling £${penceToPounds(summary.overdueTotal)}`,
    )
  }

  if (summary.unpaidCount > 0) {
    const label = summary.unpaidCount === 1 ? 'invoice' : 'invoices'
    lines.push(
      `Sent (awaiting payment): ${summary.unpaidCount} ${label} totalling £${penceToPounds(summary.unpaidTotal)}`,
    )
  }

  if (summary.draftCount > 0) {
    lines.push(`Drafts: ${summary.draftCount}`)
  }

  return lines.join('\n')
}

function formatTaxSection(summary: LedgerSummary): string {
  return [
    'TAX POSITION:',
    '',
    `Employment income: £${penceToPounds(summary.employmentIncome)}`,
    `Self-employment profit: £${penceToPounds(summary.selfEmploymentProfit)}`,
    `Total tax liability: £${penceToPounds(summary.totalTaxLiability)}`,
    `Less PAYE credit: £${penceToPounds(summary.payeTaxCredit)}`,
    `Self Assessment owed: £${penceToPounds(summary.selfAssessmentOwed)}`,
  ].join('\n')
}

function buildUserMessage(
  summary: LedgerSummary,
  todayDisplay: string,
  invoiceSummary: InvoiceSummary,
): string {
  const today = new Date(`${summary.todayDate}T00:00:00`)
  const deadlinesSection = formatDeadlinesForBriefing(today)

  const payload = {
    taxYear: summary.taxYear,
    todayDate: todayDisplay,
    totalIncomeGBP: penceToPounds(summary.totalIncome),
    totalExpensesGBP: penceToPounds(summary.totalExpenses),
    netProfitGBP: penceToPounds(summary.netProfit),
    entryCount: summary.entryCount,
    lastEntryDate: summary.lastEntryDate,
  }

  return [
    JSON.stringify(payload, null, 2),
    '',
    deadlinesSection,
    '',
    formatTaxSection(summary),
    '',
    formatInvoiceSection(invoiceSummary),
  ].join('\n')
}

/** Build summaries from current store state and ask Claude for a briefing. */
export async function generateMorningBriefing(
  todayIsoDate: string,
): Promise<string> {
  const ledgerState = useLedgerStore.getState()
  const summary = buildLedgerSummary(
    ledgerState.entries,
    ledgerState.taxYear,
    todayIsoDate,
    useProfileStore.getState().paye_tax_paid,
  )
  const invoiceSummary = buildInvoiceSummary(
    useInvoiceStore.getState().invoices,
  )

  const todayDisplay = formatTodayForBriefing()

  return sendCompletion({
    system: buildSystemPrompt(summary, todayDisplay),
    messages: [
      {
        role: 'user',
        content: buildUserMessage(summary, todayDisplay, invoiceSummary),
      },
    ],
    maxTokens: 1500,
  })
}
