export type EntryType = 'in' | 'out'

export interface LedgerEntry {
  id: string
  date: string
  description: string
  category: string
  amount: number
  type: EntryType
  taxYear: string
  /** Storage path in the `receipts` bucket, when present. */
  receiptImagePath?: string | null
}

export const EMPLOYMENT_INCOME_CATEGORY = 'Employment Income (PAYE)' as const

export type LedgerEntryUpdate = Omit<LedgerEntry, 'id' | 'taxYear'>
