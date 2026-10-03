import type { Repositories } from './types'
import {
  demoContactRepository,
  demoDocumentRepository,
  demoInvoiceRepository,
  demoLedgerRepository,
  demoProfileRepository,
} from './demo/demoRepositories'

/**
 * This public demo uses in-browser repositories seeded with fictional data.
 * The original app implemented the same interfaces against Supabase
 * (row-level security, per-user data); swapping them back is a one-file change.
 */
export const repositories: Repositories = {
  ledger: demoLedgerRepository,
  profile: demoProfileRepository,
  invoices: demoInvoiceRepository,
  contacts: demoContactRepository,
  documents: demoDocumentRepository,
}
