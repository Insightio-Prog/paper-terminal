/** Format integer pence as £X.XX with optional sign for negatives. */
export function formatPence(pence: number, showSign = false): string {
  const sign = pence < 0 ? "-" : showSign && pence > 0 ? "+" : "";
  const abs = Math.abs(pence);
  const pounds = (abs / 100).toFixed(2);
  return `${sign}£${pounds}`;
}

/** Format integer pence as a decimal pound string for inputs (e.g. "14.99"). */
export function penceToPoundsString(pence: number): string {
  return (pence / 100).toFixed(2);
}

/**
 * Parse a decimal pound string (e.g. "14.99") to integer pence.
 * Decimal-split + padding — never parseFloat * 100 (float rounding).
 * Mirrors worker/src/poundsToPence.ts; negatives still rejected (legacy contract).
 */
export function parsePoundsToPence(value: string): number | null {
  const trimmed = value.trim().replace(/^£/, "").replace(/,/g, "");
  if (!trimmed) return null;

  // Legacy contract: negative amounts are invalid (same as old parseFloat path).
  if (trimmed.startsWith("-")) return null;

  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > 2) return null;

  const pounds = Number.parseInt(wholePart, 10);
  if (!Number.isFinite(pounds)) return null;

  const frac = (fractionPart + "00").slice(0, 2);
  const pencePart = Number.parseInt(frac, 10);
  if (!Number.isFinite(pencePart)) return null;

  return pounds * 100 + pencePart;
}
