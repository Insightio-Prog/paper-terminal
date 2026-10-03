import { create } from 'zustand'
import { calculateTax } from '../lib/taxCalc'
import { repositories } from '../lib/repository'
import { dateToTaxYear, currentTaxYear } from '../lib/taxYear'
import {
  EMPLOYMENT_INCOME_CATEGORY,
  type EntryType,
  type LedgerEntry,
  type LedgerEntryUpdate,
} from '../types/ledger.types'
import { useProfileStore } from './profileStore'
import { reportStoreError } from './toastStore'

export type { EntryType, LedgerEntry, LedgerEntryUpdate }
export { EMPLOYMENT_INCOME_CATEGORY }

export const INCOME_CATEGORIES = [
  EMPLOYMENT_INCOME_CATEGORY,
  'Invoice income',
  'App Store',
  'Google Play',
  'Other Income',
] as const

export const EXPENSE_CATEGORIES = [
  'API Costs',
  'Hosting & Domains',
  'Developer Accounts',
  'Software Subscriptions',
  'Equipment',
  'Internet',
  'Professional Services',
  'Other Expense',
  'Uncategorised',
] as const

/** Filename/id helper — randomUUID needs a secure context; LAN HTTP does not. */
function createLedgerId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  console.warn(
    '[ledgerStore] crypto.getRandomValues unavailable — using Math.random() for entry id',
  )
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = (Math.random() * 16) | 0
    const v = char === 'x' ? n : (n & 0x3) | 0x8
    return v.toString(16)
  })
}

interface LedgerState {
  entries: LedgerEntry[]
  taxYear: string
  setTaxYear: (year: string) => void
  loadEntries: (taxYear: string) => Promise<void>
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'taxYear'>) => Promise<void>
  importEntries: (entries: LedgerEntry[]) => Promise<void>
  updateEntry: (id: string, updates: LedgerEntryUpdate) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (entry: LedgerEntry) => Promise<void>
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  entries: [],
  taxYear: currentTaxYear(),

  setTaxYear: (year) => set({ taxYear: year }),

  loadEntries: async (taxYear) => {
    try {
      const entries = await repositories.ledger.listByTaxYear(taxYear)
      set({ entries })
    } catch (error) {
      reportStoreError("Couldn't load ledger entries", error)
    }
  },

  addEntry: async (entry) => {
    const newEntry: LedgerEntry = {
      ...entry,
      id: createLedgerId(),
      taxYear: dateToTaxYear(entry.date),
    }
    const createdAt = new Date().toISOString()

    try {
      await repositories.ledger.insert(newEntry, createdAt)
    } catch (error) {
      reportStoreError("Couldn't save ledger entry", error)
      throw error
    }

    if (newEntry.taxYear === get().taxYear) {
      set((state) => ({ entries: [...state.entries, newEntry] }))
    }
  },

  importEntries: async (entries) => {
    if (entries.length === 0) return

    const createdAt = new Date().toISOString()
    await repositories.ledger.insertMany(entries, createdAt)
    await get().loadEntries(get().taxYear)
  },

  updateEntry: async (id, updates) => {
    const taxYear = dateToTaxYear(updates.date)

    try {
      await repositories.ledger.update(id, { ...updates, taxYear })
    } catch (error) {
      reportStoreError("Couldn't update ledger entry", error)
      throw error
    }

    set((state) => {
      if (taxYear !== state.taxYear) {
        return { entries: state.entries.filter((entry) => entry.id !== id) }
      }

      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...updates,
                taxYear,
              }
            : entry,
        ),
      }
    })
  },

  deleteEntry: async (id) => {
    try {
      await repositories.ledger.delete(id)
    } catch (error) {
      reportStoreError("Couldn't delete ledger entry", error)
      throw error
    }

    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    }))
  },

  restoreEntry: async (entry) => {
    const createdAt = new Date().toISOString()

    try {
      await repositories.ledger.insert(entry, createdAt)
    } catch (error) {
      reportStoreError("Couldn't restore ledger entry", error)
      throw error
    }

    if (entry.taxYear === get().taxYear) {
      set((state) => ({ entries: [...state.entries, entry] }))
    }
  },
}))

export function selectFilteredEntries(
  entries: LedgerEntry[],
  taxYear: string,
): LedgerEntry[] {
  return entries
    .filter((e) => e.taxYear === taxYear)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function computeTotals(
  entries: LedgerEntry[],
  payeTaxOverride = useProfileStore.getState().paye_tax_paid,
) {
  let totalIncome = 0
  let totalExpenses = 0

  for (const entry of entries) {
    if (entry.type === 'in') {
      totalIncome += entry.amount
    } else {
      totalExpenses += entry.amount
    }
  }

  const netProfit = totalIncome - totalExpenses
  const tax = calculateTax(entries, payeTaxOverride)

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    estimatedTax: tax.selfAssessmentOwed,
    tax,
  }
}

export function computeBalances(entries: LedgerEntry[]): Map<string, number> {
  let balance = 0
  const balances = new Map<string, number>()

  for (const entry of entries) {
    balance += entry.type === 'in' ? entry.amount : -entry.amount
    balances.set(entry.id, balance)
  }

  return balances
}

export function entriesToCsv(
  entries: LedgerEntry[],
  balances: Map<string, number>,
): string {
  const rows = [
    ['Date', 'Description', 'Category', 'Amount', 'Type', 'Balance'],
    ...entries.map((entry) => [
      entry.date,
      entry.description,
      entry.category,
      (entry.amount / 100).toFixed(2),
      entry.type === 'in' ? 'IN' : 'OUT',
      ((balances.get(entry.id) ?? 0) / 100).toFixed(2),
    ]),
  ]

  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n')
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
