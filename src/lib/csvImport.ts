/** Pure CSV import parsing/mapping — no React, no I/O. */

import { dateToTaxYear } from './taxYear'

export type CsvDateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'

export type AmountMode = 'single' | 'debit_credit'

export type EntryKind = 'income' | 'expense'

export type DuplicateKind = 'existing' | 'in_file' | null

export interface ColumnMapping {
  date: number | null
  description: number | null
  amount: number | null
  debit: number | null
  credit: number | null
  category: number | null
}

export interface ParsedCsvTable {
  headers: string[]
  rows: string[][]
}

/** Minimal shape for duplicate matching against ledger entries. */
export interface ExistingLedgerRef {
  date: string
  description: string
  amount: number
  type: 'in' | 'out'
}

export interface MappedImportRow {
  sourceIndex: number
  selected: boolean
  valid: boolean
  reason: string | null
  dateIso: string | null
  dateDisplay: string | null
  description: string
  category: string
  kind: EntryKind | null
  /** Absolute amount in integer pence. */
  amountPence: number | null
  /** UK tax year label from dateToTaxYear (e.g. "2026–27"). */
  taxYear: string | null
  duplicateKind: DuplicateKind
}

function invalidRow(
  partial: Omit<
    MappedImportRow,
    'selected' | 'valid' | 'taxYear' | 'duplicateKind'
  > &
    Partial<Pick<MappedImportRow, 'taxYear'>>,
): MappedImportRow {
  return {
    ...partial,
    selected: false,
    valid: false,
    taxYear: partial.taxYear ?? null,
    duplicateKind: null,
  }
}

/**
 * Convert a currency string to integer pence without parseFloat.
 * Strips £, commas, whitespace; (30.00) and leading - mean negative.
 * Returns null if unparseable. Sign is preserved (negative = expense cue).
 */
export function amountStringToPence(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null

  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1).trim()
  }

  s = s.replace(/£/g, '').replace(/,/g, '').replace(/\s/g, '')
  if (!s) return null

  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null

  const [wholePart, fracPart = ''] = s.split('.')
  const whole = Number.parseInt(wholePart, 10)
  if (!Number.isFinite(whole)) return null

  const fracDigits = (fracPart + '00').slice(0, 2)
  const frac = Number.parseInt(fracDigits, 10)
  if (!Number.isFinite(frac)) return null

  const pence = whole * 100 + frac
  return negative ? -pence : pence
}

/**
 * Parse a date string by splitting on / or - according to the chosen format.
 * Never uses `new Date(rawString)`. Returns YYYY-MM-DD or null.
 */
export function parseCsvDate(
  raw: string,
  format: CsvDateFormat,
): string | null {
  const cleaned = raw.trim()
  if (!cleaned) return null

  const parts = cleaned.split(/[/-]/)
  if (parts.length !== 3) return null

  let dayStr: string
  let monthStr: string
  let yearStr: string

  if (format === 'DD/MM/YYYY') {
    ;[dayStr, monthStr, yearStr] = parts
  } else if (format === 'MM/DD/YYYY') {
    ;[monthStr, dayStr, yearStr] = parts
  } else {
    ;[yearStr, monthStr, dayStr] = parts
  }

  const day = Number.parseInt(dayStr, 10)
  const month = Number.parseInt(monthStr, 10)
  const year = Number.parseInt(yearStr, 10)

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year)
  ) {
    return null
  }
  if (year < 1000 || year > 9999) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  // Calendar validity without new Date(string): build local Date and check.
  const probe = new Date(year, month - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Format YYYY-MM-DD as dd/mm/yyyy for preview display. */
export function formatIsoDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function entryKindToLedgerType(kind: EntryKind): 'in' | 'out' {
  return kind === 'income' ? 'in' : 'out'
}

/**
 * Match a CSV category to a known app category (case-insensitive).
 * Falls back to Other Income / Other Expense.
 */
export function resolveImportCategory(
  rawCategory: string,
  kind: EntryKind,
  incomeCategories: readonly string[],
  expenseCategories: readonly string[],
): string {
  const list = kind === 'income' ? incomeCategories : expenseCategories
  const fallback = kind === 'income' ? 'Other Income' : 'Other Expense'
  const trimmed = rawCategory.trim()
  if (!trimmed) return fallback

  const lower = trimmed.toLowerCase()
  const match = list.find((name) => name.toLowerCase() === lower)
  return match ?? fallback
}

function cell(row: string[], index: number | null): string {
  if (index === null || index < 0) return ''
  return (row[index] ?? '').trim()
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase()
}

function duplicateFingerprint(
  date: string,
  amountPence: number,
  type: 'in' | 'out',
  description: string,
): string {
  return `${date}|${amountPence}|${type}|${description.trim().toLowerCase()}`
}

/** Guess mapping + amount mode from header labels (case-insensitive). */
export function autoDetectMapping(headers: string[]): {
  mapping: ColumnMapping
  amountMode: AmountMode
} {
  const mapping: ColumnMapping = {
    date: null,
    description: null,
    amount: null,
    debit: null,
    credit: null,
    category: null,
  }

  headers.forEach((header, index) => {
    const h = normalizeHeader(header)
    if (!h) return

    if (mapping.date === null && h === 'date') {
      mapping.date = index
    } else if (
      mapping.description === null &&
      (h === 'description' || h === 'details' || h === 'narrative')
    ) {
      mapping.description = index
    } else if (mapping.amount === null && h === 'amount') {
      mapping.amount = index
    } else if (mapping.debit === null && h === 'debit') {
      mapping.debit = index
    } else if (mapping.credit === null && h === 'credit') {
      mapping.credit = index
    } else if (mapping.category === null && h === 'category') {
      mapping.category = index
    }
  })

  const amountMode: AmountMode =
    mapping.debit !== null || mapping.credit !== null
      ? 'debit_credit'
      : 'single'

  return { mapping, amountMode }
}

/**
 * Apply column mapping to a data row. Returns a MappedImportRow
 * (valid or invalid with reason). selected defaults true only when valid.
 */
export function mapCsvRow(
  row: string[],
  sourceIndex: number,
  mapping: ColumnMapping,
  amountMode: AmountMode,
  dateFormat: CsvDateFormat,
): MappedImportRow {
  const dateRaw = cell(row, mapping.date)
  const description = cell(row, mapping.description)
  const category = cell(row, mapping.category)

  if (!dateRaw && !description) {
    return invalidRow({
      sourceIndex,
      reason: 'Looks like a balance/summary line',
      dateIso: null,
      dateDisplay: null,
      description,
      category,
      kind: null,
      amountPence: null,
    })
  }

  const dateIso = parseCsvDate(dateRaw, dateFormat)
  if (!dateIso) {
    return invalidRow({
      sourceIndex,
      reason: 'Bad or missing date',
      dateIso: null,
      dateDisplay: null,
      description,
      category,
      kind: null,
      amountPence: null,
    })
  }

  const taxYear = dateToTaxYear(dateIso)
  const dateDisplay = formatIsoDateDisplay(dateIso)

  if (!description) {
    return invalidRow({
      sourceIndex,
      reason: 'Missing description',
      dateIso,
      dateDisplay,
      description,
      category,
      kind: null,
      amountPence: null,
      taxYear,
    })
  }

  let kind: EntryKind | null = null
  let amountPence: number | null = null

  if (amountMode === 'single') {
    const signed = amountStringToPence(cell(row, mapping.amount))
    if (signed === null || signed === 0) {
      return invalidRow({
        sourceIndex,
        reason: 'Unparseable amount',
        dateIso,
        dateDisplay,
        description,
        category,
        kind: null,
        amountPence: null,
        taxYear,
      })
    }
    kind = signed < 0 ? 'expense' : 'income'
    amountPence = Math.abs(signed)
  } else {
    const debitRaw = cell(row, mapping.debit)
    const creditRaw = cell(row, mapping.credit)
    const hasDebit = debitRaw.length > 0
    const hasCredit = creditRaw.length > 0

    if (hasDebit === hasCredit) {
      return invalidRow({
        sourceIndex,
        reason: hasDebit
          ? 'Both debit and credit populated'
          : 'Neither debit nor credit populated',
        dateIso,
        dateDisplay,
        description,
        category,
        kind: null,
        amountPence: null,
        taxYear,
      })
    }

    if (hasDebit) {
      const signed = amountStringToPence(debitRaw)
      if (signed === null || signed === 0) {
        return invalidRow({
          sourceIndex,
          reason: 'Unparseable debit amount',
          dateIso,
          dateDisplay,
          description,
          category,
          kind: null,
          amountPence: null,
          taxYear,
        })
      }
      kind = 'expense'
      amountPence = Math.abs(signed)
    } else {
      const signed = amountStringToPence(creditRaw)
      if (signed === null || signed === 0) {
        return invalidRow({
          sourceIndex,
          reason: 'Unparseable credit amount',
          dateIso,
          dateDisplay,
          description,
          category,
          kind: null,
          amountPence: null,
          taxYear,
        })
      }
      kind = 'income'
      amountPence = Math.abs(signed)
    }
  }

  return {
    sourceIndex,
    selected: true,
    valid: true,
    reason: null,
    dateIso,
    dateDisplay,
    description,
    category,
    kind,
    amountPence,
    taxYear,
    duplicateKind: null,
  }
}

export function mapAllCsvRows(
  rows: string[][],
  mapping: ColumnMapping,
  amountMode: AmountMode,
  dateFormat: CsvDateFormat,
): MappedImportRow[] {
  return rows.map((row, index) =>
    mapCsvRow(row, index, mapping, amountMode, dateFormat),
  )
}

/**
 * Mark potential duplicates against existing ledger entries and within the file.
 * Duplicates stay valid but default to unselected.
 */
export function annotateDuplicates(
  rows: MappedImportRow[],
  existing: ExistingLedgerRef[],
): MappedImportRow[] {
  const existingKeys = new Set(
    existing.map((entry) =>
      duplicateFingerprint(
        entry.date,
        entry.amount,
        entry.type,
        entry.description,
      ),
    ),
  )

  const seenInFile = new Map<string, number>()

  return rows.map((row) => {
    if (
      !row.valid ||
      !row.dateIso ||
      row.kind === null ||
      row.amountPence === null
    ) {
      return { ...row, duplicateKind: null }
    }

    const key = duplicateFingerprint(
      row.dateIso,
      row.amountPence,
      entryKindToLedgerType(row.kind),
      row.description,
    )

    let duplicateKind: DuplicateKind = null
    if (existingKeys.has(key)) {
      duplicateKind = 'existing'
    } else {
      const prior = seenInFile.get(key) ?? 0
      if (prior > 0) duplicateKind = 'in_file'
      seenInFile.set(key, prior + 1)
    }

    return {
      ...row,
      duplicateKind,
      selected: duplicateKind === null,
    }
  })
}

/** Distinct tax years among valid rows, sorted. */
export function uniqueTaxYears(rows: MappedImportRow[]): string[] {
  const years = new Set<string>()
  for (const row of rows) {
    if (row.valid && row.taxYear) years.add(row.taxYear)
  }
  return [...years].sort()
}

/** Human summary when an import spans multiple tax years. */
export function formatTaxYearSpanSummary(years: string[]): string | null {
  if (years.length <= 1) return null
  if (years.length === 2) return `Spans ${years[0]} and ${years[1]}`
  const head = years.slice(0, -1).join(', ')
  return `Spans ${head} and ${years[years.length - 1]}`
}

/** Build a ParsedCsvTable from PapaParse output (header: false). */
export function tableFromRawRows(raw: string[][]): ParsedCsvTable | null {
  if (!raw.length) return null

  const headers = raw[0].map((cell, index) => {
    const trimmed = (cell ?? '').trim()
    return trimmed || `Column ${index + 1}`
  })

  const rows = raw.slice(1).filter((row) =>
    row.some((cell) => (cell ?? '').trim().length > 0),
  )

  return { headers, rows }
}
