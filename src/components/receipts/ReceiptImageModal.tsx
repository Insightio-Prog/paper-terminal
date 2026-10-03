import { useEffect, useState } from 'react'
import { getFileUrl, removeFile } from '../../lib/demo/files'
import {
  useLedgerStore,
  type LedgerEntry,
} from '../../stores/ledgerStore'


interface ReceiptImageModalProps {
  open: boolean
  entry: LedgerEntry
  onClose: () => void
}

export function ReceiptImageModal({
  open,
  entry,
  onClose,
}: ReceiptImageModalProps) {
  const updateEntry = useLedgerStore((s) => s.updateEntry)
  const storagePath = entry.receiptImagePath

  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !storagePath) return

    let cancelled = false
    setLoading(true)
    setSignedUrl(null)
    setError(null)

    const url = getFileUrl(storagePath)
    if (!cancelled) {
      if (url) {
        setSignedUrl(url)
      } else {
        setError("Couldn't load receipt. The demo only keeps photos in this browser.")
      }
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [open, storagePath])

  if (!open || !storagePath) return null

  const path = storagePath

  async function handleRemove() {
    if (
      !window.confirm(
        'Remove this receipt image? The ledger entry will be kept.',
      )
    ) {
      return
    }

    setRemoving(true)
    setError(null)

    try {
      removeFile(path)

      await updateEntry(entry.id, {
        date: entry.date,
        description: entry.description,
        category: entry.category,
        amount: entry.amount,
        type: entry.type,
        receiptImagePath: null,
      })

      onClose()
    } catch (err) {
      console.error('[ReceiptImageModal] remove failed', err)
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't remove receipt. Try again.",
      )
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-image-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-border bg-bg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
          <h2
            id="receipt-image-title"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink"
          >
            Receipt
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={removing}
            aria-label="Close"
            className="font-mono text-[16px] leading-none text-ink-faint hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="font-mono text-[13px] text-ink-faint">
              Loading receipt…
            </p>
          )}

          {!loading && error && (
            <p className="font-mono text-[13px] text-expense">{error}</p>
          )}

          {!loading && !error && signedUrl && (
            <img
              src={signedUrl}
              alt="Receipt"
              className="mx-auto max-h-[60vh] w-auto max-w-full border border-border"
              onError={() => {
                setSignedUrl(null)
                setError("Couldn't display receipt image.")
              }}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={removing}
            onClick={() => {
              void handleRemove()
            }}
            className="rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-expense transition-colors duration-150 hover:bg-bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {removing ? 'Removing…' : 'Remove receipt'}
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={onClose}
            className="rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
