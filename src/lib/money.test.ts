import { describe, expect, it } from 'vitest'
import {
  formatPence,
  parsePoundsToPence,
  penceToPoundsString,
} from './money'

describe('parsePoundsToPence', () => {
  it('returns null for empty string', () => {
    expect(parsePoundsToPence('')).toBeNull()
  })

  it('returns null for whitespace-only', () => {
    expect(parsePoundsToPence('   ')).toBeNull()
  })

  it('strips a leading £', () => {
    expect(parsePoundsToPence('£12.50')).toBe(1250)
  })

  it('strips comma thousands separators', () => {
    expect(parsePoundsToPence('1,234.56')).toBe(123456)
  })

  it('parses a plain integer with no decimal point', () => {
    expect(parsePoundsToPence('12')).toBe(1200)
  })

  it('pads a single decimal digit', () => {
    expect(parsePoundsToPence('12.5')).toBe(1250)
  })

  it('parses exactly two decimal digits', () => {
    expect(parsePoundsToPence('12.99')).toBe(1299)
  })

  it('returns null for 3+ decimal digits (deliberate strictness)', () => {
    expect(parsePoundsToPence('12.999')).toBeNull()
  })

  it('returns null for non-numeric strings', () => {
    expect(parsePoundsToPence('abc')).toBeNull()
  })

  it('returns null for negative amounts (legacy contract)', () => {
    expect(parsePoundsToPence('-5')).toBeNull()
  })

  // Hand-traced cases from the float→decimal-split fix session:
  // callers may use `?? 0`; the parser itself returns null here.
  it('hand-traced bugfix cases return null (not 0)', () => {
    expect(parsePoundsToPence('')).toBeNull()
    expect(parsePoundsToPence('12.999')).toBeNull()
    expect(parsePoundsToPence('abc')).toBeNull()
    expect(parsePoundsToPence('-5')).toBeNull()
  })
})

describe('formatPence', () => {
  it('formats zero', () => {
    expect(formatPence(0)).toBe('£0.00')
  })

  it('formats a negative amount with a minus sign', () => {
    expect(formatPence(-1250)).toBe('-£12.50')
  })

  it('formats a large value', () => {
    expect(formatPence(1_234_567_89)).toBe('£1234567.89')
  })

  it('adds a plus sign when showSign is true', () => {
    expect(formatPence(100, true)).toBe('+£1.00')
  })
})

describe('penceToPoundsString', () => {
  it('formats zero', () => {
    expect(penceToPoundsString(0)).toBe('0.00')
  })

  it('formats a negative amount as a signed decimal string', () => {
    expect(penceToPoundsString(-1250)).toBe('-12.50')
  })

  it('formats a large value', () => {
    expect(penceToPoundsString(1_234_567_89)).toBe('1234567.89')
  })
})
