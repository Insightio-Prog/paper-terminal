import { useRef, useState, type ChangeEvent } from 'react'
import {
  blobToBase64,
  extractReceiptFromJpegBase64,
  type ReceiptExtractResult,
} from '../../ai/receiptExtract'
import { useIsMobile } from '../../hooks/useIsMobile'
import { getFileUrl, putFile, removeFile } from '../../lib/demo/files'
import { ReceiptConfirmCard } from './ReceiptConfirmCard'

const MAX_EDGE_PX = 1500
const JPEG_QUALITY = 0.85

/**
 * Filename-safe unique id. Prefer crypto.randomUUID() (secure contexts);
 * fall back to getRandomValues for LAN HTTP testing where randomUUID is missing.
 */
function createReceiptId(): string {
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
    // RFC 4122 version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  console.warn(
    '[ReceiptCapture] crypto.getRandomValues unavailable — using Math.random() for filename id',
  )
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = (Math.random() * 16) | 0
    const v = char === 'x' ? n : (n & 0x3) | 0x8
    return v.toString(16)
  })
}

async function resizeImageToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    let width = bitmap.width
    let height = bitmap.height
    const longest = Math.max(width, height)

    if (longest > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / longest
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error("Couldn't prepare the image for upload.")
    }

    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error("Couldn't encode the image as JPEG."))
        },
        'image/jpeg',
        JPEG_QUALITY,
      )
    })

    return blob
  } finally {
    bitmap.close()
  }
}

const triggerButtonClass =
  'rounded-sm border border-border bg-bg-inset px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60'

export function ReceiptCapture() {
  const isMobile = useIsMobile()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<ReceiptExtractResult | null>(
    null,
  )

  const busy = uploading || extracting
  const showConfirm =
    Boolean(extraction?.readable && storagePath) && !extracting && !uploading

  function resetToCapture(options?: { status?: string | null }) {
    setUploading(false)
    setExtracting(false)
    setError(null)
    setStatusMessage(options?.status ?? null)
    setStoragePath(null)
    setPreviewUrl(null)
    setExtraction(null)
  }

  async function handleCancel() {
    const path = storagePath
    if (path) removeFile(path)

    resetToCapture({ status: 'Receipt discarded — upload removed.' })
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Allow re-selecting the same file after an error.
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setExtracting(false)
    setError(null)
    setStatusMessage(null)
    setStoragePath(null)
    setPreviewUrl(null)
    setExtraction(null)

    try {
      const resized = await resizeImageToJpeg(file)
      // Temporary size check for Chunk B — confirms client resize is working.
      console.log(
        '[ReceiptCapture] original bytes:',
        file.size,
        'resized bytes:',
        resized.size,
      )

      const path = `receipts/${createReceiptId()}.jpg`
      await putFile(path, resized)
      const previewSrc = getFileUrl(path)
      if (!previewSrc) {
        throw new Error("Couldn't create a preview for the upload.")
      }

      setStoragePath(path)
      setPreviewUrl(previewSrc)
      setUploading(false)

      // Chunk C — vision extract from the in-memory resized blob (no Storage re-fetch).
      setExtracting(true)
      const imageBase64 = await blobToBase64(resized)
      const result = await extractReceiptFromJpegBase64(imageBase64)
      setExtraction(result)

      if (!result.readable) {
        setError(
          result.error?.trim() ||
            "Couldn't read this receipt — try a clearer photo.",
        )
      }
    } catch (err) {
      console.error('[ReceiptCapture] capture failed', err)
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't upload that receipt. Try again."
      setError(message)
    } finally {
      setUploading(false)
      setExtracting(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Receipt Capture
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!showConfirm && (
          <>
            <p className="mb-4 font-mono text-[13px] text-ink-secondary">
              Take or choose a receipt photo. It is resized on your device,
              then uploaded and read by Claude before you confirm a ledger
              entry.
            </p>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                void handleFileChange(event)
              }}
              disabled={busy}
              className="sr-only"
              tabIndex={-1}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleFileChange(event)
              }}
              disabled={busy}
              className="sr-only"
              tabIndex={-1}
            />

            <div className="flex flex-wrap gap-2">
              {isMobile && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cameraInputRef.current?.click()}
                  className={triggerButtonClass}
                >
                  Take Photo
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className={triggerButtonClass}
              >
                {isMobile ? 'Choose File' : 'Upload Receipt'}
              </button>
            </div>
          </>
        )}

        {statusMessage && !busy && !showConfirm && (
          <p className="mt-4 font-mono text-[13px] text-income">
            {statusMessage}
          </p>
        )}

        {uploading && (
          <p className="mt-4 font-mono text-[13px] text-ink-faint">
            Resizing and uploading…
          </p>
        )}

        {extracting && (
          <p className="mt-4 font-mono text-[13px] text-ink-faint">
            <span className="text-accent">❯</span> Reading receipt…
          </p>
        )}

        {error && !extracting && !uploading && !showConfirm && (
          <div className="mt-4 space-y-2">
            <p className="font-mono text-[13px] text-expense">{error}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className={triggerButtonClass}
            >
              Try again
            </button>
          </div>
        )}

        {showConfirm && extraction && storagePath && (
          <ReceiptConfirmCard
            extraction={extraction}
            storagePath={storagePath}
            previewUrl={previewUrl}
            onSaved={() => {
              resetToCapture({ status: 'Saved to ledger.' })
            }}
            onCancelled={() => {
              void handleCancel()
            }}
          />
        )}
      </div>
    </div>
  )
}
