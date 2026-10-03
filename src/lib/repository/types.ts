import type { Contact, ContactInput } from '../../types/contact.types'
import type { Document, DocumentInput } from '../../types/document.types'
import type { Invoice } from '../../types/invoice.types'
import type {
  LedgerEntry,
  LedgerEntryUpdate,
} from '../../types/ledger.types'
import type { BusinessProfile } from '../../types/profile.types'

export interface LedgerRepository {
  listByTaxYear(taxYear: string): Promise<LedgerEntry[]>
  insert(entry: LedgerEntry, createdAt: string): Promise<void>
  insertMany(entries: LedgerEntry[], createdAt: string): Promise<void>
  update(
    id: string,
    updates: LedgerEntryUpdate & { taxYear: string },
  ): Promise<void>
  delete(id: string): Promise<void>
}

export interface ProfileRepository {
  get(): Promise<BusinessProfile | null>
  save(profile: BusinessProfile): Promise<void>
}

export interface InvoiceRepository {
  list(): Promise<Invoice[]>
  updateStatus(
    id: string,
    status: Invoice['status'],
    updatedAt: string,
  ): Promise<void>
  getNextInvoiceNumber(): Promise<string>
  insert(invoice: Invoice): Promise<void>
  update(invoice: Invoice): Promise<void>
  delete(id: string): Promise<void>
}

export interface ContactRepository {
  list(): Promise<Contact[]>
  add(contact: ContactInput, now: string): Promise<string>
  update(id: string, contact: Contact): Promise<void>
  delete(id: string): Promise<void>
}

export interface DocumentRepository {
  list(): Promise<Document[]>
  add(fields: DocumentInput, now: string): Promise<string>
  update(id: string, document: Document): Promise<void>
  delete(id: string): Promise<void>
}

export interface Repositories {
  ledger: LedgerRepository
  profile: ProfileRepository
  invoices: InvoiceRepository
  contacts: ContactRepository
  documents: DocumentRepository
}
