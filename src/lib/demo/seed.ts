import type { Contact } from '../../types/contact.types'
import type { Document } from '../../types/document.types'
import type { Invoice, LineItem } from '../../types/invoice.types'
import type { LedgerEntry } from '../../types/ledger.types'
import type { BusinessProfile } from '../../types/profile.types'
import { dateToTaxYear } from '../taxYear'
import { formatPence } from '../money'
import { clearAllDemoData, newId, readJson, writeJson } from './storage'
import { clearAllFiles } from './files'

/** Everything here is fictional: Sam and Fernlight Studio do not exist. */

const SEEDED_KEY = 'seeded'
const RESEED_AFTER_DAYS = 10

function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return iso(d)
}

function stamp(dateIso: string): string {
  return `${dateIso}T09:00:00.000Z`
}

function line(description: string, quantity: number, unitPence: number): LineItem {
  return {
    id: newId(),
    description,
    quantity,
    unit_price: unitPence,
    amount: Math.round(quantity * unitPence),
  }
}

function invoice(
  n: number,
  client: { name: string; company: string; email: string; address: string },
  issueOffset: number,
  dueOffset: number,
  status: Invoice['status'],
  items: LineItem[],
  notes: string,
): Invoice {
  const total = items.reduce((s, i) => s + i.amount, 0)
  const issue = daysFromToday(issueOffset)
  return {
    id: newId(),
    invoice_number: `INV-${String(n).padStart(3, '0')}`,
    client_name: client.name,
    client_company: client.company,
    client_email: client.email,
    client_address: client.address,
    issue_date: issue,
    due_date: daysFromToday(dueOffset),
    line_items: items,
    subtotal: total,
    total,
    status,
    notes,
    payment_terms: 'Payment due within 14 days',
    created_at: stamp(issue),
    updated_at: stamp(issue),
  }
}

export interface SeedBundle {
  profile: BusinessProfile
  ledger: LedgerEntry[]
  invoices: Invoice[]
  contacts: Contact[]
  documents: Document[]
}

export function buildSeed(): SeedBundle {
  const today = new Date()
  const todayIso = iso(today)

  const clients = {
    cafe: {
      name: 'Priya Shah',
      company: 'Brightwater Café',
      email: 'priya@brightwater.example',
      address: '12 Quay Street\nManchester\nM3 4AB',
    },
    physio: {
      name: 'Tom Ellery',
      company: 'Northgate Physio',
      email: 'tom@northgatephysio.example',
      address: '4 Northgate Row\nChester\nCH1 2HN',
    },
    bakery: {
      name: 'Grace Moyo',
      company: 'Oakleaf Bakery',
      email: 'grace@oakleaf.example',
      address: '88 Mill Lane\nLeeds\nLS2 7DR',
    },
    gym: {
      name: 'Dan Keating',
      company: 'Kestrel Fitness',
      email: 'dan@kestrelfitness.example',
      address: 'Unit 6, Riverside Park\nLiverpool\nL3 9PP',
    },
  }

  const terms = 'Payment due within 14 days'
  const footer =
    'Bank: Example Bank   Sort code: 00-00-00   Account: 00000000\nThank you for your business!'
  const notes = `${terms}\n\n${footer}`

  const invoices: Invoice[] = [
    invoice(1, clients.cafe, -140, -126, 'paid', [
      line('Loyalty app: design and prototype', 1, 120000),
      line('iOS build and App Store submission', 1, 60000),
    ], notes),
    invoice(2, clients.physio, -110, -96, 'paid', [
      line('Booking reminders app: development (days)', 6, 30000),
    ], notes),
    invoice(3, clients.bakery, -80, -66, 'paid', [
      line('Website maintenance: 3 months', 3, 15000),
    ], notes),
    invoice(4, clients.cafe, -20, 10, 'sent', [
      line('Loyalty app v2: new rewards screen (days)', 6, 30000),
      line('Push notification setup', 1, 60000),
    ], notes),
    invoice(5, clients.gym, -50, -20, 'overdue', [
      line('Class timetable widget (days)', 3, 30000),
      line('Hosting and setup', 1, 6000),
    ], notes),
    invoice(6, clients.physio, -1, 13, 'draft', [
      line('Patient feedback form: development (days)', 2, 30000),
      line('Content updates', 4, 3000),
    ], notes),
  ]

  // Ledger ---------------------------------------------------------------
  const yearStart = Number.parseInt(dateToTaxYear(todayIso).split('–')[0]!, 10)
  const ledger: LedgerEntry[] = []
  const add = (
    date: string,
    description: string,
    category: string,
    amount: number,
    type: 'in' | 'out',
  ) => {
    if (date > todayIso) return
    ledger.push({
      id: newId(),
      date,
      description,
      category,
      amount,
      type,
      taxYear: dateToTaxYear(date),
      receiptImagePath: null,
    })
  }

  const apiCosts = [2140, 2870, 3350, 2490, 4120, 3180, 3560, 2950, 3410, 3020, 2780, 3300]
  const appStore = [154000, 168500, 181200, 192400, 209800, 198600, 220500, 233100, 218700, 240400, 229200, 247300]
  const playStore = [32800, 36400, 39200, 41600, 45000, 43600, 49200, 51400, 48400, 53600, 51600, 56400]

  for (let i = 0; i < 12; i++) {
    const month = 3 + i // April = index 3
    const year = yearStart + Math.floor(month / 12)
    const m = (month % 12) + 1
    const ym = `${year}-${String(m).padStart(2, '0')}`
    add(`${ym}-03`, 'Cloudflare Workers and domains', 'Hosting & Domains', 960, 'out')
    add(`${ym}-08`, 'Anthropic API usage', 'API Costs', apiCosts[i]!, 'out')
    add(`${ym}-12`, 'Home broadband', 'Internet', 3200, 'out')
    add(`${ym}-15`, 'Figma subscription', 'Software Subscriptions', 1200, 'out')
    add(`${ym}-20`, 'GitHub subscription', 'Software Subscriptions', 400, 'out')
    add(`${ym}-26`, 'App Store payout', 'App Store', appStore[i]!, 'in')
    add(`${ym}-27`, 'Google Play payout', 'Google Play', playStore[i]!, 'in')
  }

  add(`${yearStart}-04-14`, 'Apple Developer Programme (annual)', 'Developer Accounts', 7900, 'out')
  add(`${yearStart}-05-09`, 'Year-end accountant fee', 'Professional Services', 18000, 'out')
  add(`${yearStart}-06-18`, '27-inch monitor', 'Equipment', 21900, 'out')
  add(`${yearStart}-08-05`, 'USB-C dock', 'Equipment', 8900, 'out')
  add(`${yearStart}-07-22`, 'Conference talk fee', 'Other Income', 15000, 'in')

  // Paid invoices were logged to "Invoice income" when they were paid.
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      const paidOn = daysFromToday(
        Math.round(
          (new Date(inv.due_date + 'T12:00:00').getTime() -
            new Date().getTime()) /
            86_400_000,
        ) - 3,
      )
      add(
        paidOn,
        `Invoice ${inv.invoice_number} — ${inv.client_name}`,
        'Invoice income',
        inv.total,
        'in',
      )
    }
  }

  ledger.sort((a, b) => a.date.localeCompare(b.date))

  // Contacts ---------------------------------------------------------------
  const mkContact = (
    c: (typeof clients)[keyof typeof clients],
    phone: string,
    note: string,
  ): Contact => ({
    id: newId(),
    name: c.name,
    company: c.company,
    email: c.email,
    phone,
    address: c.address.replace(/\n/g, ', '),
    notes: note,
    created_at: stamp(daysFromToday(-150)),
    updated_at: stamp(daysFromToday(-5)),
  })

  const contacts: Contact[] = [
    mkContact(clients.cafe, '0161 000 0101', 'Loyalty app client. Prefers email. Pays on time, usually early.'),
    mkContact(clients.physio, '01244 000 202', 'Booking reminders app. Quarterly check-in call.'),
    mkContact(clients.bakery, '0113 000 0303', 'Small website retainer. Very easy to work with.'),
    mkContact(clients.gym, '0151 000 0404', 'Invoice INV-005 is overdue. Chase politely by email first.'),
    {
      id: newId(),
      name: 'Hannah Voss',
      company: 'Voss & Co Accountants',
      email: 'hannah@vossco.example',
      phone: '0161 000 0505',
      address: 'Deansgate, Manchester',
      notes: 'My accountant. Year-end paperwork goes to her.',
      created_at: stamp(daysFromToday(-150)),
      updated_at: stamp(daysFromToday(-30)),
    },
  ]

  // Documents ----------------------------------------------------------------
  const mkDoc = (
    title: string,
    category: string,
    content: string,
    ageDays: number,
  ): Document => ({
    id: newId(),
    title,
    content,
    category,
    created_at: stamp(daysFromToday(-ageDays - 5)),
    updated_at: stamp(daysFromToday(-ageDays)),
  })

  const documents: Document[] = [
    mkDoc(
      'Friendly payment reminder',
      'Email',
      'Subject: Quick nudge on invoice INV-005\n\nHi Dan,\n\nHope the new timetable widget is working well for your members. I wanted to flag that invoice INV-005 is now past its due date.\n\nCould you let me know when payment is likely to go through? Happy to resend the invoice if that helps.\n\nThanks very much,\nSam',
      2,
    ),
    mkDoc(
      'Brightwater Café: loyalty app v2 proposal',
      'Proposal',
      'Scope\n- New rewards screen with stamp animation\n- Push notifications for weekly offers\n- Basic analytics dashboard\n\nTimeline: 3 weeks\nPrice: £2,400 fixed\n\nNext steps: confirm scope, then I will book the first week.',
      12,
    ),
    mkDoc(
      'Standard terms of work (template)',
      'Contract',
      '1. Payment is due within 14 days of the invoice date.\n2. Work remains my property until paid in full.\n3. Two rounds of revisions are included in a fixed price.\n4. Either side can end the work with 7 days written notice.',
      40,
    ),
    mkDoc(
      'Self Assessment checklist',
      'Notes',
      '- Register for Self Assessment (deadline 5 October)\n- Keep every receipt: photograph them as I go\n- Check mileage and home-office costs\n- Book a call with Hannah in January',
      18,
    ),
    mkDoc(
      'Ideas for Q4',
      'General',
      'Offer a fixed-price "app health check" to existing clients.\nWrite up the loyalty app as a case study.\nLook at a second platform for the physio app.',
      6,
    ),
  ]

  // Pre-written morning briefing (plain text), so the first view is instant.
  const overdue = invoices.find((i) => i.status === 'overdue')!
  const sent = invoices.find((i) => i.status === 'sent')!
  const briefing = [
    `Good morning Sam. Two things need your attention today.`,
    ``,
    `${overdue.invoice_number} for ${overdue.client_company} (${formatPence(overdue.total)}) is overdue. A friendly reminder is saved in your Documents under Email.`,
    ``,
    `${sent.invoice_number} for ${sent.client_company} (${formatPence(sent.total)}) falls due in 10 days, so nothing to chase yet.`,
    ``,
    `This is a pre-written sample. Press regenerate to have Claude write a fresh one from the live books.`,
  ].join('\n')

  const profile: BusinessProfile = {
    business_name: 'Fernlight Studio',
    owner_name: 'Sam Hartley',
    address: '21 Canal Street\nManchester\nM1 3HE',
    email: 'sam@fernlight.example',
    phone: '0161 000 0000',
    website: 'fernlight.example',
    vat_number: '',
    accent_colour: '#C25A3A',
    default_payment_terms: terms,
    default_notes: footer,
    logo_path: '',
    paye_tax_paid: 0,
    follow_up_template: '',
    auto_log_subscription: false,
    briefing_cache: briefing,
    briefing_date: todayIso,
    updated_at: new Date().toISOString(),
  }

  return { profile, ledger, invoices, contacts, documents }
}

export function seedDemoData(): void {
  const seed = buildSeed()
  writeJson('profile', seed.profile)
  writeJson('ledger', seed.ledger)
  writeJson('invoices', seed.invoices)
  writeJson('contacts', seed.contacts)
  writeJson('documents', seed.documents)
  writeJson(SEEDED_KEY, { at: Date.now() })
}

/** Seed on first visit, and refresh sample data if it has gone stale. */
export function ensureDemoData(): void {
  const meta = readJson<{ at: number } | null>(SEEDED_KEY, null)
  const stale =
    !meta || Date.now() - meta.at > RESEED_AFTER_DAYS * 86_400_000
  if (stale) seedDemoData()
}

export function resetDemoData(): void {
  clearAllDemoData()
  clearAllFiles()
  seedDemoData()
}
