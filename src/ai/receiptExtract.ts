import { demoApiErrorMessage, demoApiUrl } from '../lib/demo/api'

export interface ReceiptExtractDate {
  day: number
  month: number
  year: number
}

export interface ReceiptExtractResult {
  readable: boolean
  vendor: string | null
  date: ReceiptExtractDate | null
  amount: string | null
  amount_pence: number | null
  suggested_category: string | null
  error?: string
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/** POST resized JPEG base64 to the Worker receipt-extract endpoint. */
export async function extractReceiptFromJpegBase64(
  imageBase64: string,
): Promise<ReceiptExtractResult> {
  const proxyUrl = demoApiUrl()

  let response: Response
  try {
    response = await fetch(`${proxyUrl}/receipt-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_base64: imageBase64 }),
    })
  } catch {
    throw new Error("Couldn't reach Claude — check your connection.")
  }

  let body: ReceiptExtractResult | { error?: string }
  try {
    body = (await response.json()) as ReceiptExtractResult | { error?: string }
  } catch {
    throw new Error("Claude couldn't respond just now. Try again in a moment.")
  }

  if (!response.ok) {
    if (
      body &&
      typeof body === 'object' &&
      'readable' in body &&
      body.readable === false
    ) {
      return body as ReceiptExtractResult
    }
    throw new Error(demoApiErrorMessage(response.status))
  }

  return body as ReceiptExtractResult
}
