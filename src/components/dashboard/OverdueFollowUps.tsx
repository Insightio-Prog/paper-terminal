import { useMemo, useState } from 'react'
import { sendCompletion } from '../../ai/claude'
import {
  applyFollowUpTemplate,
  formatFollowUpAmount,
  formatFollowUpDueDate,
} from '../../lib/followUpTemplate'
import { stripMarkdown } from '../../lib/stripMarkdown'
import { useDocumentStore } from '../../stores/documentStore'
import { useInvoiceStore } from '../../stores/invoiceStore'
import { useProfileStore } from '../../stores/profileStore'
import type { Invoice } from '../../types/invoice.types'

function todayIsoLocal(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatHumanLocalDate(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysOverdue(dueDate: string, today: string): number {
  const due = parseLocalDate(dueDate)
  const now = parseLocalDate(today)
  return Math.round((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))
}

function isOverdueInvoice(invoice: Invoice, today: string): boolean {
  if (!invoice.due_date || invoice.due_date >= today) return false
  // Store promotes sent → overdue on load; include both so the list stays accurate.
  return invoice.status === 'sent' || invoice.status === 'overdue'
}

function toneGuidance(days: number): string {
  if (days < 14) {
    return 'Tone: friendly reminder — polite and light.'
  }
  if (days <= 30) {
    return 'Tone: polite but direct — acknowledge the delay clearly.'
  }
  return 'Tone: firm but professional — clear that payment is overdue.'
}

function buildFollowUpPrompt(params: {
  clientName: string
  invoiceNumber: string
  amount: string
  issueDate: string
  dueDate: string
  days: number
  businessName: string
}): string {
  const business = params.businessName.trim() || 'Paper Terminal'
  return [
    'Draft a concise follow-up email about an overdue invoice.',
    '',
    `Client name: ${params.clientName}`,
    `Invoice number: ${params.invoiceNumber}`,
    `Amount due: ${params.amount}`,
    `Issue date: ${params.issueDate}`,
    `Due date: ${params.dueDate}`,
    `Days overdue: ${params.days}`,
    `Business name (sign-off): ${business}`,
    '',
    toneGuidance(params.days),
    'Write a professional follow-up email.',
    'Put a clear subject line on the first line as "Subject: ...".',
    'Do not use placeholders.',
    `Sign off with ${business}.`,
    'Return only the email text — no commentary.',
  ].join('\n')
}

export function OverdueFollowUps() {
  const invoices = useInvoiceStore((s) => s.invoices)
  const businessName = useProfileStore((s) => s.business_name)
  const followUpTemplate = useProfileStore((s) => s.follow_up_template)
  const addDocument = useDocumentStore((s) => s.addDocument)

  const today = useMemo(() => todayIsoLocal(), [])
  const hasTemplate = followUpTemplate.trim().length > 0

  const overdue = useMemo(
    () =>
      invoices
        .filter((invoice) => isOverdueInvoice(invoice, today))
        .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [invoices, today],
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  if (overdue.length === 0) return null

  async function handleDraft(invoice: Invoice) {
    if (busy) return

    setActiveId(invoice.id)
    setDraft(null)
    setError(null)
    setCopied(false)
    setSaved(false)

    const days = daysOverdue(invoice.due_date, today)
    const clientName =
      invoice.client_name.trim() ||
      invoice.client_company.trim() ||
      'the client'
    const amount = formatFollowUpAmount(invoice.total)
    const template = followUpTemplate.trim()

    // Template path: instant substitution, no Claude call.
    if (template) {
      setDraft(
        applyFollowUpTemplate(template, {
          client_name: clientName,
          invoice_number: invoice.invoice_number,
          amount,
          due_date: formatFollowUpDueDate(invoice.due_date),
          days_overdue: String(days),
          business_name: businessName.trim() || 'Paper Terminal',
        }),
      )
      return
    }

    setBusy(true)
    try {
      const text = await sendCompletion({
        system: [
          'You are a writing assistant inside Paper Terminal, a UK sole trader business suite.',
          'Draft overdue-invoice follow-up emails only. Plain text. No markdown.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: buildFollowUpPrompt({
              clientName,
              invoiceNumber: invoice.invoice_number,
              amount,
              issueDate: formatHumanLocalDate(invoice.issue_date),
              dueDate: formatHumanLocalDate(invoice.due_date),
              days,
              businessName,
            }),
          },
        ],
        maxTokens: 1000,
      })
      setDraft(text)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Claude couldn't respond just now. Try again in a moment."
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(stripMarkdown(draft))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy to clipboard.")
    }
  }

  async function handleSave(invoice: Invoice) {
    if (!draft || saved) return
    const clientName =
      invoice.client_name.trim() ||
      invoice.client_company.trim() ||
      'Client'
    try {
      await addDocument({
        title: `Follow-up: ${invoice.invoice_number} — ${clientName}`,
        content: stripMarkdown(draft),
        category: 'Email',
      })
      setSaved(true)
    } catch {
      // Toast already shown by documentStore
    }
  }

  return (
    <div className="shrink-0 border-b border-border bg-bg px-4 py-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
        Overdue invoices
      </div>

      <ul className="mt-2 space-y-0 font-mono text-[13px]">
        {overdue.map((invoice) => {
          const days = daysOverdue(invoice.due_date, today)
          const isActive = activeId === invoice.id
          const daysLabel =
            days === 1 ? '1 day overdue' : `${days} days overdue`
          const hasDraft = isActive && !!draft
          const showButton = !(hasTemplate && hasDraft)

          return (
            <li
              key={invoice.id}
              className="border-b border-border last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <span className="min-w-0 flex-1 text-ink">
                  {invoice.client_name || invoice.client_company || 'Client'}
                  <span className="text-ink-faint">
                    {' '}
                    · {invoice.invoice_number}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-ink">
                  {formatFollowUpAmount(invoice.total)}
                </span>
                <span className="shrink-0 text-accent">{daysLabel}</span>
                {showButton && (
                  <button
                    type="button"
                    disabled={busy && isActive}
                    onClick={() => void handleDraft(invoice)}
                    className="shrink-0 font-mono text-[12px] text-accent transition-colors duration-150 hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {busy && isActive
                      ? '❯ Working...'
                      : hasDraft
                        ? '❯ Redraft'
                        : '❯ Draft follow-up'}
                  </button>
                )}
              </div>

              {isActive && busy && (
                <p className="pb-2 font-mono text-[13px] text-ink-faint">
                  <span className="text-accent">❯</span> Drafting follow-up...
                </p>
              )}

              {isActive && error && !busy && (
                <p className="pb-2 font-mono text-[13px] text-expense">
                  {error}
                </p>
              )}

              {isActive && draft && !busy && (
                <div className="mb-2 border border-l-2 border-border border-l-accent bg-bg-raised px-3 py-2">
                  <p className="min-w-0 whitespace-pre-wrap font-mono text-[13px] text-ink-faint">
                    <span className="text-accent">❯</span>{' '}
                    {stripMarkdown(draft)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave(invoice)}
                      disabled={saved}
                      className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:text-ink disabled:cursor-default disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {saved ? 'Saved to Email' : 'Save to Email'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
