import type { LedgerEntry } from '../types/ledger.types'
import { dateToTaxYear } from './taxYear'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_SLUGS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const

/** Tax-year month order: April (start) → March (end). */
const TAX_YEAR_MONTH_NUMBERS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const

export interface LedgerPeriodTotals {
  income: number
  expenses: number
  net: number
  entryCount: number
}

export interface LedgerPeriodSummary extends LedgerPeriodTotals {
  filtered: LedgerEntry[]
}

export interface TaxYearMonthOption {
  /** `YYYY-MM` key for the calendar month within the tax year. */
  value: string
  /** e.g. "April 2026" — always includes the calendar year. */
  label: string
  /** Inclusive ISO date `YYYY-MM-DD`. */
  start: string
  /** Inclusive ISO date `YYYY-MM-DD`. */
  end: string
  /** Short slug for filenames, e.g. "apr". */
  slug: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Build ISO date from numeric Y/M/D — never from an arbitrary date string. */
function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Days in calendar month (month is 1–12). Uses numeric Date construction only. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Filter entries whose `date` (YYYY-MM-DD) falls within the inclusive range.
 * Comparison is lexical on ISO strings — no Date parsing of entry dates.
 * Optional `category` requires an exact match on `entry.category` (case-sensitive).
 */
export function filterEntriesByDateRange(
  entries: LedgerEntry[],
  start: string,
  end: string,
  category?: string,
): LedgerEntry[] {
  return entries.filter((entry) => {
    if (entry.date < start || entry.date > end) return false
    if (category !== undefined && entry.category !== category) return false
    return true
  })
}

/** Income / expenses / net for a set of entries (amounts in pence). */
export function computePeriodTotals(
  entries: LedgerEntry[],
): LedgerPeriodTotals {
  let income = 0
  let expenses = 0
  for (const entry of entries) {
    if (entry.type === 'in') {
      income += entry.amount
    } else {
      expenses += entry.amount
    }
  }
  return {
    income,
    expenses,
    net: income - expenses,
    entryCount: entries.length,
  }
}

/**
 * Shared period summary used by Command Bar `get_ledger_breakdown` and the
 * Ledger month picker: filter by inclusive ISO date range, then total.
 * Optional `category` is passed through to the date-range filter.
 */
export function summarizeLedgerPeriod(
  entries: LedgerEntry[],
  start: string,
  end: string,
  category?: string,
): LedgerPeriodSummary {
  const filtered = filterEntriesByDateRange(entries, start, end, category)
  const totals = computePeriodTotals(filtered)
  return { filtered, ...totals }
}

/**
 * The 12 calendar months belonging to a UK tax year label (e.g. "2026–27"),
 * ordered April (start year) through March (end year), each labelled with year.
 * Start year is confirmed via dateToTaxYear on 6 April (tax-year boundary).
 */
export function taxYearMonthOptions(taxYear: string): TaxYearMonthOption[] {
  const candidateStart = Number.parseInt(taxYear.split('–')[0] ?? '', 10)
  if (!Number.isFinite(candidateStart)) return []

  // 6 April of the labelled start year must resolve to this tax year.
  if (dateToTaxYear(isoFromParts(candidateStart, 4, 6)) !== taxYear) {
    return []
  }
  const startYear = candidateStart

  return TAX_YEAR_MONTH_NUMBERS.map((month) => {
    const year = month >= 4 ? startYear : startYear + 1
    const lastDay = daysInMonth(year, month)
    const monthIndex = month - 1
    return {
      value: `${year}-${pad2(month)}`,
      label: `${MONTH_LABELS[monthIndex]} ${year}`,
      start: isoFromParts(year, month, 1),
      end: isoFromParts(year, month, lastDay),
      slug: MONTH_SLUGS[monthIndex],
    }
  })
}
