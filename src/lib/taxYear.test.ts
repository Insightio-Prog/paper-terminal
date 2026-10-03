import { describe, expect, it } from 'vitest'
import { dateToTaxYear } from './taxYear'

describe('dateToTaxYear', () => {
  it('uses an en-dash (U+2013) in the label, not a hyphen', () => {
    const label = dateToTaxYear('2026-06-01')
    expect(label).toBe('2026\u201327')
    expect(label.includes('\u2013')).toBe(true)
    expect(label.includes('-')).toBe(false)
  })

  it('keeps 5 April in the previous tax year', () => {
    expect(dateToTaxYear('2026-04-05')).toBe('2025\u201326')
  })

  it('starts the new tax year on exactly 6 April', () => {
    expect(dateToTaxYear('2026-04-06')).toBe('2026\u201327')
  })

  it('maps a mid-year date to the current tax year', () => {
    expect(dateToTaxYear('2026-09-15')).toBe('2026\u201327')
  })

  it('maps January–March into the tax year that began the previous April', () => {
    expect(dateToTaxYear('2027-01-10')).toBe('2026\u201327')
    expect(dateToTaxYear('2027-02-28')).toBe('2026\u201327')
    expect(dateToTaxYear('2027-03-31')).toBe('2026\u201327')
  })

  it('pads the end-year suffix to two digits', () => {
    expect(dateToTaxYear('1999-05-01')).toBe('1999\u201300')
  })
})
