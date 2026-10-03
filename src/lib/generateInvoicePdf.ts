import { jsPDF } from 'jspdf'
import { registerGeistMono } from './fonts/geistMono'
import { getLogoUrl } from './logo'
import type { BusinessProfile } from '../types/profile.types'
import type { Invoice, LineItem } from '../types/invoice.types'

const INVOICE_FONT = 'GeistMono'

const MARGIN = 20
const PAGE_WIDTH = 210
const CONTENT_WIDTH = 170
const RIGHT_X = MARGIN + CONTENT_WIDTH
const DARK_GREY: [number, number, number] = [51, 51, 51]
const MUTED_GREY: [number, number, number] = [136, 136, 136]
const PAID_GREEN: [number, number, number] = [94, 124, 90]
const ROW_GREY: [number, number, number] = [245, 245, 245]
const WHITE: [number, number, number] = [255, 255, 255]

const COL_DESC_X = MARGIN
const COL_DESC_W = 85
const COL_QTY_X = COL_DESC_X + COL_DESC_W
const COL_QTY_W = 20
const COL_UNIT_X = COL_QTY_X + COL_QTY_W
const COL_UNIT_W = 35
const COL_AMOUNT_X = COL_UNIT_X + COL_UNIT_W
const COL_AMOUNT_W = 30

const ROW_HEIGHT = 8
const FOOTER_Y = 277

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function formatIsoDate(iso: string): string {
  const [yearStr, monthStr, dayStr] = iso.split('-')
  const date = new Date(
    Number.parseInt(yearStr, 10),
    Number.parseInt(monthStr, 10) - 1,
    Number.parseInt(dayStr, 10),
  )
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatPounds(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatQty(quantity: number): string {
  return String(Number.parseFloat(quantity.toFixed(4)))
}

function imageFormatFromPath(path: string): 'PNG' | 'JPEG' | 'WEBP' {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG'
  if (ext === 'webp') return 'WEBP'
  return 'PNG'
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch logo (${response.status})`)
  }
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read logo'))
    reader.readAsDataURL(blob)
  })
}

async function loadLogoForPdf(
  logoPath: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> {
  try {
    const signedUrl = await getLogoUrl(logoPath)
    if (!signedUrl) return null
    const dataUrl = await fetchAsDataUrl(signedUrl)
    return {
      dataUrl,
      format: imageFormatFromPath(logoPath),
    }
  } catch {
    return null
  }
}

function setAccent(doc: jsPDF, accent: [number, number, number]) {
  doc.setTextColor(accent[0], accent[1], accent[2])
  doc.setDrawColor(accent[0], accent[1], accent[2])
}

function setDarkGrey(doc: jsPDF) {
  doc.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2])
}

function drawHairline(doc: jsPDF, y: number, accent: [number, number, number]) {
  doc.setDrawColor(accent[0], accent[1], accent[2])
  doc.setLineWidth(0.176)
  doc.line(MARGIN, y, RIGHT_X, y)
}

function drawStatusBadge(
  doc: jsPDF,
  status: Invoice['status'],
  y: number,
  accent: [number, number, number],
) {
  const label = status.toUpperCase()
  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(8)

  const textWidth = doc.getTextWidth(label)
  const padding = 2
  const badgeW = textWidth + padding * 2
  const badgeH = 5
  const badgeX = RIGHT_X - badgeW

  const fill = status === 'paid' ? PAID_GREEN : accent

  doc.setFillColor(fill[0], fill[1], fill[2])
  doc.rect(badgeX, y - 3.5, badgeW, badgeH, 'F')
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])
  doc.text(label, badgeX + padding, y)
}

function drawTableHeader(
  doc: jsPDF,
  y: number,
  accent: [number, number, number],
) {
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(MARGIN, y, CONTENT_WIDTH, ROW_HEIGHT, 'F')

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2])

  const textY = y + 5.5
  doc.text('DESCRIPTION', COL_DESC_X + 2, textY)
  doc.text('QTY', COL_QTY_X + COL_QTY_W - 2, textY, { align: 'right' })
  doc.text('UNIT PRICE', COL_UNIT_X + COL_UNIT_W - 2, textY, { align: 'right' })
  doc.text('AMOUNT', COL_AMOUNT_X + COL_AMOUNT_W - 2, textY, { align: 'right' })
}

function drawLineItemRow(
  doc: jsPDF,
  item: LineItem,
  y: number,
  rowIndex: number,
) {
  const fill = rowIndex % 2 === 0 ? WHITE : ROW_GREY
  doc.setFillColor(fill[0], fill[1], fill[2])
  doc.rect(MARGIN, y, CONTENT_WIDTH, ROW_HEIGHT, 'F')

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(9)
  setDarkGrey(doc)

  const textY = y + 5.5
  const desc = doc.splitTextToSize(item.description || '—', COL_DESC_W - 4)
  doc.text(desc[0] ?? '—', COL_DESC_X + 2, textY)
  doc.text(formatQty(item.quantity), COL_QTY_X + COL_QTY_W - 2, textY, {
    align: 'right',
  })
  doc.text(formatPounds(item.unit_price), COL_UNIT_X + COL_UNIT_W - 2, textY, {
    align: 'right',
  })
  doc.text(formatPounds(item.amount), COL_AMOUNT_X + COL_AMOUNT_W - 2, textY, {
    align: 'right',
  })
}

function drawFooter(
  doc: jsPDF,
  profile: BusinessProfile,
  accent: [number, number, number],
) {
  drawHairline(doc, FOOTER_Y - 4, accent)

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED_GREY[0], MUTED_GREY[1], MUTED_GREY[2])

  const footerText = [profile.business_name, profile.email]
    .filter(Boolean)
    .join(' | ')

  if (footerText) {
    doc.text(footerText, PAGE_WIDTH / 2, FOOTER_Y, { align: 'center' })
  }
}

export async function generateInvoicePdf(
  invoice: Invoice,
  profile: BusinessProfile,
): Promise<void> {
  const accent = hexToRgb(profile.accent_colour || '#C25A3A')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerGeistMono(doc)

  let leftY = MARGIN
  let rightY = MARGIN

  if (profile.logo_path) {
    const logo = await loadLogoForPdf(profile.logo_path)
    if (logo) {
      const props = doc.getImageProperties(logo.dataUrl)
      const ratio = props.width / props.height
      let imgW = 40
      let imgH = imgW / ratio
      if (imgH > 20) {
        imgH = 20
        imgW = imgH * ratio
      }
      doc.addImage(logo.dataUrl, logo.format, MARGIN, MARGIN, imgW, imgH)
      leftY = MARGIN + imgH + 4
    }
  }

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(14)
  setAccent(doc, accent)
  if (profile.business_name) {
    doc.text(profile.business_name, MARGIN, leftY)
    leftY += 6
  }

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(9)
  setDarkGrey(doc)

  if (profile.owner_name) {
    doc.text(profile.owner_name, MARGIN, leftY)
    leftY += 4.5
  }

  for (const line of profile.address.split('\n').filter(Boolean)) {
    doc.text(line, MARGIN, leftY)
    leftY += 4.5
  }

  const contactParts = [profile.email, profile.phone].filter(Boolean)
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  ·  '), MARGIN, leftY)
    leftY += 4.5
  }

  if (profile.website) {
    doc.text(profile.website, MARGIN, leftY)
    leftY += 4.5
  }

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(22)
  setAccent(doc, accent)
  doc.text('INVOICE', RIGHT_X, rightY, { align: 'right' })
  rightY += 9

  doc.setFontSize(11)
  setDarkGrey(doc)
  doc.text(invoice.invoice_number, RIGHT_X, rightY, { align: 'right' })
  rightY += 5

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(9)
  doc.text(`Issued: ${formatIsoDate(invoice.issue_date)}`, RIGHT_X, rightY, {
    align: 'right',
  })
  rightY += 4.5
  doc.text(`Due: ${formatIsoDate(invoice.due_date)}`, RIGHT_X, rightY, {
    align: 'right',
  })
  rightY += 5

  drawStatusBadge(doc, invoice.status, rightY, accent)
  rightY += 6

  const headerBottom = Math.max(leftY, rightY) + 5
  drawHairline(doc, headerBottom, accent)

  let y = headerBottom + 8

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(8)
  setAccent(doc, accent)
  doc.text('BILL TO', MARGIN, y)
  y += 5

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(10)
  setDarkGrey(doc)
  doc.text(invoice.client_name || '—', MARGIN, y)
  y += 5

  if (invoice.client_company) {
    doc.setFont(INVOICE_FONT, 'normal')
    doc.setFontSize(9)
    doc.text(invoice.client_company, MARGIN, y)
    y += 4.5
  }

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(9)
  for (const line of invoice.client_address.split('\n').filter(Boolean)) {
    doc.text(line, MARGIN, y)
    y += 4.5
  }

  if (invoice.client_email) {
    doc.text(invoice.client_email, MARGIN, y)
    y += 4.5
  }

  y += 10
  drawTableHeader(doc, y, accent)
  y += ROW_HEIGHT

  for (let i = 0; i < invoice.line_items.length; i++) {
    if (y + ROW_HEIGHT > FOOTER_Y - 50) {
      drawFooter(doc, profile, accent)
      doc.addPage()
      y = MARGIN
      drawTableHeader(doc, y, accent)
      y += ROW_HEIGHT
    }

    drawLineItemRow(doc, invoice.line_items[i], y, i)
    y += ROW_HEIGHT
  }

  y += 4
  drawHairline(doc, y, accent)
  y += 6

  doc.setFont(INVOICE_FONT, 'normal')
  doc.setFontSize(9)
  setDarkGrey(doc)
  doc.text('Subtotal', COL_UNIT_X + COL_UNIT_W - 2, y, { align: 'right' })
  doc.text(formatPounds(invoice.subtotal), COL_AMOUNT_X + COL_AMOUNT_W - 2, y, {
    align: 'right',
  })
  y += 6

  doc.setFont(INVOICE_FONT, 'bold')
  doc.setFontSize(11)
  setAccent(doc, accent)
  doc.text('Total Due', COL_UNIT_X + COL_UNIT_W - 2, y, { align: 'right' })
  doc.text(formatPounds(invoice.total), COL_AMOUNT_X + COL_AMOUNT_W - 2, y, {
    align: 'right',
  })
  y += 12

  if (invoice.notes.trim()) {
    if (y > FOOTER_Y - 30) {
      drawFooter(doc, profile, accent)
      doc.addPage()
      y = MARGIN
    }

    doc.setFont(INVOICE_FONT, 'bold')
    doc.setFontSize(8)
    setAccent(doc, accent)
    doc.text('NOTES & PAYMENT TERMS', MARGIN, y)
    y += 5

    doc.setFont(INVOICE_FONT, 'normal')
    doc.setFontSize(9)
    setDarkGrey(doc)
    const noteLines = doc.splitTextToSize(invoice.notes, CONTENT_WIDTH)
    for (const line of noteLines) {
      if (y > FOOTER_Y - 10) {
        drawFooter(doc, profile, accent)
        doc.addPage()
        y = MARGIN
      }
      doc.text(line, MARGIN, y)
      y += 4.5
    }
  }

  drawFooter(doc, profile, accent)

  doc.save(`${invoice.invoice_number}.pdf`)
}
