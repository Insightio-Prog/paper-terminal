import { newId, readJson, writeJson } from '../../demo/storage'
import type { Contact } from '../../../types/contact.types'
import type { Document } from '../../../types/document.types'
import type { Invoice } from '../../../types/invoice.types'
import type { LedgerEntry } from '../../../types/ledger.types'
import type { BusinessProfile } from '../../../types/profile.types'
import type {
  ContactRepository,
  DocumentRepository,
  InvoiceRepository,
  LedgerRepository,
  ProfileRepository,
} from '../types'

/**
 * Demo repositories: same interfaces as the original Supabase versions,
 * backed by the visitor's own browser storage. The rest of the app
 * (stores, screens, Claude tools) does not know the difference.
 */

export const demoLedgerRepository: LedgerRepository = {
  async listByTaxYear(taxYear) {
    return readJson<LedgerEntry[]>('ledger', [])
      .filter((e) => e.taxYear === taxYear)
      .sort((a, b) => a.date.localeCompare(b.date))
  },
  async insert(entry) {
    const all = readJson<LedgerEntry[]>('ledger', [])
    writeJson('ledger', [...all, entry])
  },
  async insertMany(entries) {
    const all = readJson<LedgerEntry[]>('ledger', [])
    writeJson('ledger', [...all, ...entries])
  },
  async update(id, updates) {
    const all = readJson<LedgerEntry[]>('ledger', [])
    writeJson(
      'ledger',
      all.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    )
  },
  async delete(id) {
    const all = readJson<LedgerEntry[]>('ledger', [])
    writeJson(
      'ledger',
      all.filter((e) => e.id !== id),
    )
  },
}

export const demoProfileRepository: ProfileRepository = {
  async get() {
    return readJson<BusinessProfile | null>('profile', null)
  },
  async save(profile) {
    writeJson('profile', profile)
  },
}

export const demoInvoiceRepository: InvoiceRepository = {
  async list() {
    return readJson<Invoice[]>('invoices', []).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )
  },
  async updateStatus(id, status, updatedAt) {
    const all = readJson<Invoice[]>('invoices', [])
    writeJson(
      'invoices',
      all.map((i) =>
        i.id === id ? { ...i, status, updated_at: updatedAt } : i,
      ),
    )
  },
  async getNextInvoiceNumber() {
    const all = readJson<Invoice[]>('invoices', [])
    const highest = all.reduce((max, i) => {
      const n = Number.parseInt(i.invoice_number.replace(/\D/g, ''), 10)
      return Number.isFinite(n) && n > max ? n : max
    }, 0)
    return `INV-${String(highest + 1).padStart(3, '0')}`
  },
  async insert(invoice) {
    const all = readJson<Invoice[]>('invoices', [])
    writeJson('invoices', [...all, invoice])
  },
  async update(invoice) {
    const all = readJson<Invoice[]>('invoices', [])
    writeJson(
      'invoices',
      all.map((i) => (i.id === invoice.id ? invoice : i)),
    )
  },
  async delete(id) {
    const all = readJson<Invoice[]>('invoices', [])
    writeJson(
      'invoices',
      all.filter((i) => i.id !== id),
    )
  },
}

export const demoContactRepository: ContactRepository = {
  async list() {
    return readJson<Contact[]>('contacts', []).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  },
  async add(contact, now) {
    const id = newId()
    const all = readJson<Contact[]>('contacts', [])
    writeJson('contacts', [
      ...all,
      { ...contact, id, created_at: now, updated_at: now },
    ])
    return id
  },
  async update(id, contact) {
    const all = readJson<Contact[]>('contacts', [])
    writeJson(
      'contacts',
      all.map((c) => (c.id === id ? contact : c)),
    )
  },
  async delete(id) {
    const all = readJson<Contact[]>('contacts', [])
    writeJson(
      'contacts',
      all.filter((c) => c.id !== id),
    )
  },
}

export const demoDocumentRepository: DocumentRepository = {
  async list() {
    return readJson<Document[]>('documents', []).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    )
  },
  async add(fields, now) {
    const id = newId()
    const all = readJson<Document[]>('documents', [])
    writeJson('documents', [
      ...all,
      { ...fields, id, created_at: now, updated_at: now },
    ])
    return id
  },
  async update(id, document) {
    const all = readJson<Document[]>('documents', [])
    writeJson(
      'documents',
      all.map((d) => (d.id === id ? document : d)),
    )
  },
  async delete(id) {
    const all = readJson<Document[]>('documents', [])
    writeJson(
      'documents',
      all.filter((d) => d.id !== id),
    )
  },
}
