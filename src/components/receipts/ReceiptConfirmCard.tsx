import { useMemo, useState } from 'react'
import type { ReceiptExtractResult } from '../../ai/receiptExtract'
import { parsePoundsToPence, penceToPoundsString } from '../../lib/money'
import {
  EXPENSE_CATEGORIES,
  useLedgerStore,
} from '../../stores/ledgerStore'
import {
  ledgerInputClass,
  ledgerSelectClass,
} from '../ledger/ledgerStyles'

function datePartsToIso(
  date: ReceiptExtractResult['date'],
): string {
  if (!date) return ''
  const year = String(date.year)
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveCategory(suggested: string | null): string {
  if (
    suggested &&
    (EXPENSE_CATEGORIES as readonly string[]).includes(suggested)
  ) {
    return suggested
  }
  return 'Uncategorised'
}

const actionButtonClass =
  'rounded-sm border border-border bg-bg-inset px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60'

interface ReceiptConfirmCardProps {
  extraction: ReceiptExtractResult
  storagePath: string
  previewUrl: string | null
  onSaved: () => void
  onCancelled: () => void
}

export function ReceiptConfirmCard({
  extraction,
  storagePath,
  previewUrl,
  onSaved,
  onCancelled,
}: ReceiptConfirmCardProps) {
  const addEntry = useLedgerStore((s) => s.addEntry)

  const [vendor, setVendor] = useState(extraction.vendor?.trim() ?? '')
  const [date, setDate] = useState(() => datePartsToIso(extraction.date))
  const [amountDisplay, setAmountDisplay] = useState(() =>
    extraction.amount_pence !== null && extraction.amount_pence > 0
      ? penceToPoundsString(extraction.amount_pence)
      : '',
  )
  const [amountPence, setAmountPence] = useState<number | null>(
    extraction.amount_pence !== null && extraction.amount_pence > 0
      ? extraction.amount_pence
      : null,
  )
  const [category, setCategory] = useState(() =>
    resolveCategory(extraction.suggested_category),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => {
    const pence =
      amountPence ??
      (amountDisplay.trim() ? parsePoundsToPence(amountDisplay) : null)
    return Boolean(date) && pence !== null && pence > 0
  }, [amountDisplay, amountPence, date])

  function commitAmountBlur() {
    const pence = parsePoundsToPence(amountDisplay)
    if (pence === null) {
      setAmountPence(null)
      return
    }
    setAmountPence(pence)
    setAmountDisplay(penceToPoundsString(pence))
  }

  async function handleSave() {
    setError(null)
    commitAmountBlur()
    const pence =
      parsePoundsToPence(amountDisplay) ??
      (amountPence !== null && amountPence > 0 ? amountPence : null)

    if (!date || pence === null || pence <= 0) {
      setError('Enter a valid date and amount before saving.')
      return
    }

    setSaving(true)
    try {
      await addEntry({
        date,
        description: vendor.trim(),
        category,
        amount: pence,
        type: 'out',
        receiptImagePath: storagePath,
      })
      onSaved()
    } catch (err) {
      console.error('[ReceiptConfirmCard] save failed', err)
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save this receipt to the ledger.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 space-y-4 border border-border bg-bg-raised px-3 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
        Confirm receipt
      </p>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Receipt preview"
          className="max-h-[28vh] w-auto max-w-full border border-border"
        />
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
            Vendor
          </label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="vendor (optional)"
            className={`${ledgerInputClass} w-full`}
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${ledgerInputClass} w-full max-w-[180px]`}
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
            Amount
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amountDisplay}
            onChange={(e) => {
              setAmountDisplay(e.target.value)
              setAmountPence(null)
            }}
            onBlur={commitAmountBlur}
            placeholder="0.00"
            className={`${ledgerInputClass} w-full max-w-[140px] text-right tabular-nums`}
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${ledgerSelectClass} w-full`}
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="font-mono text-[13px] text-expense">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={() => {
            void handleSave()
          }}
          className={actionButtonClass}
        >
          {saving ? 'Saving…' : 'Save to Ledger'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancelled}
          className={actionButtonClass}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
