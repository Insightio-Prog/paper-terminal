import { describe, expect, it } from 'vitest'
import {
  EMPLOYMENT_INCOME_CATEGORY,
  type LedgerEntry,
} from '../types/ledger.types'
import {
  calculateTax,
  PERSONAL_ALLOWANCE_PENCE,
  TRADING_ALLOWANCE_PENCE,
} from './taxCalc'

function entry(
  overrides: Partial<LedgerEntry> & Pick<LedgerEntry, 'amount' | 'type'>,
): LedgerEntry {
  return {
    id: overrides.id ?? 'e1',
    date: overrides.date ?? '2026-06-01',
    description: overrides.description ?? 'fixture',
    category: overrides.category ?? 'Invoice income',
    amount: overrides.amount,
    type: overrides.type,
    taxYear: overrides.taxYear ?? '2026–27',
  }
}

describe('calculateTax', () => {
  it('returns zeros for an empty ledger', () => {
    const tax = calculateTax([])
    expect(tax.employmentIncome).toBe(0)
    expect(tax.selfEmploymentIncome).toBe(0)
    expect(tax.totalExpenses).toBe(0)
    expect(tax.selfEmploymentProfit).toBe(0)
    expect(tax.totalIncome).toBe(0)
    expect(tax.taxableIncome).toBe(0)
    expect(tax.totalIncomeTax).toBe(0)
    expect(tax.class4NI).toBe(0)
    expect(tax.totalLiability).toBe(0)
    expect(tax.selfAssessmentOwed).toBe(0)
  })

  it('handles employment income only (PAYE covers liability)', () => {
    const tax = calculateTax([
      entry({
        amount: 2_000_000,
        type: 'in',
        category: EMPLOYMENT_INCOME_CATEGORY,
      }),
    ])
    expect(tax.employmentIncome).toBe(2_000_000)
    expect(tax.selfEmploymentIncome).toBe(0)
    expect(tax.selfEmploymentProfit).toBe(0)
    expect(tax.taxableIncome).toBe(2_000_000 - PERSONAL_ALLOWANCE_PENCE)
    expect(tax.basicRateTax).toBe(
      Math.round((2_000_000 - PERSONAL_ALLOWANCE_PENCE) * 0.2),
    )
    expect(tax.class4NI).toBe(0)
    expect(tax.payeTaxCredit).toBe(tax.estimatedPayeTax)
    expect(tax.selfAssessmentOwed).toBe(0)
  })

  it('handles self-employment income only (trading allowance when no expenses)', () => {
    // £30k SE, £0 expenses → £1k allowance wins → profit £29k
    const gross = 3_000_000
    const profit = gross - TRADING_ALLOWANCE_PENCE
    const tax = calculateTax([
      entry({ amount: gross, type: 'in', category: 'Invoice income' }),
    ])
    expect(tax.employmentIncome).toBe(0)
    expect(tax.selfEmploymentIncome).toBe(gross)
    expect(tax.selfEmploymentProfit).toBe(profit)
    expect(tax.taxableIncome).toBe(profit - PERSONAL_ALLOWANCE_PENCE)
    expect(tax.basicRateTax).toBe(
      Math.round((profit - PERSONAL_ALLOWANCE_PENCE) * 0.2),
    )
    expect(tax.class4NI).toBe(
      Math.round((profit - PERSONAL_ALLOWANCE_PENCE) * 0.09),
    )
    expect(tax.estimatedPayeTax).toBe(0)
    expect(tax.selfAssessmentOwed).toBe(tax.totalLiability)
  })

  it('handles mixed employment and self-employment income', () => {
    const tax = calculateTax([
      entry({
        id: 'emp',
        amount: 1_500_000,
        type: 'in',
        category: EMPLOYMENT_INCOME_CATEGORY,
      }),
      entry({
        id: 'se',
        amount: 1_500_000,
        type: 'in',
        category: 'Invoice income',
      }),
    ])
    expect(tax.employmentIncome).toBe(1_500_000)
    expect(tax.selfEmploymentIncome).toBe(1_500_000)
    // Allowance wins over £0 expenses → SE profit £14k; total = emp + SE profit
    expect(tax.selfEmploymentProfit).toBe(1_500_000 - TRADING_ALLOWANCE_PENCE)
    expect(tax.totalIncome).toBe(
      1_500_000 + (1_500_000 - TRADING_ALLOWANCE_PENCE),
    )
    expect(tax.class4NI).toBeGreaterThan(0)
    expect(tax.estimatedPayeTax).toBeGreaterThan(0)
  })

  it('floors self-employment profit at 0 when expenses exceed income', () => {
    // Gross SE above £1k so rule-1 drop-out does not apply; expenses win.
    const tax = calculateTax([
      entry({ amount: 200_000, type: 'in', category: 'Invoice income' }),
      entry({
        id: 'exp',
        amount: 500_000,
        type: 'out',
        category: 'Software Subscriptions',
      }),
    ])
    expect(tax.totalExpenses).toBe(500_000)
    expect(tax.selfEmploymentProfit).toBe(0)
    // Intentional floor-at-zero: SE losses do not offset PAYE in totalIncome.
    expect(tax.totalIncome).toBe(0)
    expect(tax.taxableIncome).toBe(0)
    expect(tax.totalIncomeTax).toBe(0)
    expect(tax.class4NI).toBe(0)
  })

  it('charges no income tax when adjusted SE profit is below the personal allowance', () => {
    // £10k gross → £9k after allowance — still below PA
    const tax = calculateTax([
      entry({ amount: 1_000_000, type: 'in', category: 'Invoice income' }),
    ])
    expect(tax.selfEmploymentProfit).toBe(1_000_000 - TRADING_ALLOWANCE_PENCE)
    expect(tax.totalIncome).toBeLessThan(PERSONAL_ALLOWANCE_PENCE)
    expect(tax.taxableIncome).toBe(0)
    expect(tax.totalIncomeTax).toBe(0)
  })

  it('applies basic-rate tax above the personal allowance', () => {
    const gross = 3_000_000
    const profit = gross - TRADING_ALLOWANCE_PENCE
    const tax = calculateTax([
      entry({ amount: gross, type: 'in', category: 'Invoice income' }),
    ])
    const taxable = profit - PERSONAL_ALLOWANCE_PENCE
    expect(tax.taxableIncome).toBe(taxable)
    expect(tax.basicRateTax).toBe(Math.round(taxable * 0.2))
    expect(tax.higherRateTax).toBe(0)
  })

  it('applies higher-rate tax when taxable income exceeds the basic band', () => {
    // £60k gross → £59k after allowance → taxable above £37,700 basic band
    const gross = 6_000_000
    const profit = gross - TRADING_ALLOWANCE_PENCE
    const tax = calculateTax([
      entry({ amount: gross, type: 'in', category: 'Invoice income' }),
    ])
    expect(tax.higherRateTax).toBeGreaterThan(0)
    expect(tax.basicRateTax).toBe(Math.round(3_770_000 * 0.2))
    expect(tax.higherRateTax).toBe(
      Math.round((profit - PERSONAL_ALLOWANCE_PENCE - 3_770_000) * 0.4),
    )
  })

  it('charges no Class 4 NI when SE profit is at or below the lower limit', () => {
    const tax = calculateTax([
      entry({ amount: 1_000_000, type: 'in', category: 'Invoice income' }),
    ])
    expect(tax.selfEmploymentProfit).toBeLessThanOrEqual(1_257_000)
    expect(tax.class4NI).toBe(0)
  })

  it('charges Class 4 NI at 9% between the lower and upper limits', () => {
    // £20k gross → £19k after allowance (still between NI limits)
    const gross = 2_000_000
    const profit = gross - TRADING_ALLOWANCE_PENCE
    const tax = calculateTax([
      entry({ amount: gross, type: 'in', category: 'Invoice income' }),
    ])
    expect(tax.class4NI).toBe(Math.round((profit - 1_257_000) * 0.09))
  })

  it('charges Class 4 NI with 2% above the upper limit', () => {
    const gross = 6_000_000
    const profit = gross - TRADING_ALLOWANCE_PENCE
    const tax = calculateTax([
      entry({ amount: gross, type: 'in', category: 'Invoice income' }),
    ])
    const basicNi = (5_027_000 - 1_257_000) * 0.09
    const higherNi = (profit - 5_027_000) * 0.02
    expect(tax.class4NI).toBe(Math.round(basicNi + higherNi))
  })

  it('uses a provided PAYE override as the tax credit', () => {
    const tax = calculateTax(
      [
        entry({
          amount: 2_000_000,
          type: 'in',
          category: EMPLOYMENT_INCOME_CATEGORY,
        }),
        entry({
          id: 'se',
          amount: 2_000_000,
          type: 'in',
          category: 'Invoice income',
        }),
      ],
      500_000,
    )
    expect(tax.payeTaxOverride).toBe(500_000)
    expect(tax.payeTaxCredit).toBe(500_000)
    expect(tax.payeTaxCredit).not.toBe(tax.estimatedPayeTax)
  })

  it('falls back to estimated PAYE when override is 0', () => {
    const tax = calculateTax([
      entry({
        amount: 2_000_000,
        type: 'in',
        category: EMPLOYMENT_INCOME_CATEGORY,
      }),
    ])
    expect(tax.payeTaxOverride).toBe(0)
    expect(tax.payeTaxCredit).toBe(tax.estimatedPayeTax)
    expect(tax.estimatedPayeTax).toBeGreaterThan(0)
  })

  it('floors selfAssessmentOwed at 0 (never negative)', () => {
    const tax = calculateTax(
      [
        entry({
          amount: 1_500_000,
          type: 'in',
          category: EMPLOYMENT_INCOME_CATEGORY,
        }),
      ],
      5_000_000,
    )
    expect(tax.totalLiability).toBeLessThan(5_000_000)
    expect(tax.selfAssessmentOwed).toBe(0)
  })

  // Trading allowance — gap fixed 27 Jul 2026 (this session). Previous
  // "KNOWN GAP" test locking the old incorrect behaviour was removed.

  it('zeros SE profit when gross SE income is under £1,000', () => {
    const tax = calculateTax([
      entry({ amount: 80_000, type: 'in', category: 'Invoice income' }),
      entry({
        id: 'exp',
        amount: 10_000,
        type: 'out',
        category: 'Software Subscriptions',
      }),
    ])
    expect(tax.selfEmploymentIncome).toBe(80_000)
    expect(tax.selfEmploymentProfit).toBe(0)
    expect(tax.totalIncome).toBe(0)
    expect(tax.class4NI).toBe(0)
    expect(tax.totalIncomeTax).toBe(0)
  })

  it('zeros SE profit when gross SE income is exactly £1,000', () => {
    const tax = calculateTax([
      entry({
        amount: TRADING_ALLOWANCE_PENCE,
        type: 'in',
        category: 'Invoice income',
      }),
    ])
    expect(tax.selfEmploymentIncome).toBe(TRADING_ALLOWANCE_PENCE)
    expect(tax.selfEmploymentProfit).toBe(0)
    expect(tax.totalIncome).toBe(0)
  })

  it('uses the £1,000 allowance when it exceeds actual expenses', () => {
    // £5,000 income, £200 expenses → allowance wins → profit £4,000
    const tax = calculateTax([
      entry({ amount: 500_000, type: 'in', category: 'Invoice income' }),
      entry({
        id: 'exp',
        amount: 20_000,
        type: 'out',
        category: 'Software Subscriptions',
      }),
    ])
    expect(tax.selfEmploymentProfit).toBe(400_000)
    expect(tax.totalIncome).toBe(400_000)
  })

  it('uses actual expenses when they exceed the £1,000 allowance', () => {
    // £5,000 income, £3,000 expenses → expenses win → profit £2,000
    const tax = calculateTax([
      entry({ amount: 500_000, type: 'in', category: 'Invoice income' }),
      entry({
        id: 'exp',
        amount: 300_000,
        type: 'out',
        category: 'Software Subscriptions',
      }),
    ])
    expect(tax.selfEmploymentProfit).toBe(200_000)
    expect(tax.totalIncome).toBe(200_000)
  })

  it('does not apply trading allowance to employment/PAYE-only income', () => {
    const tax = calculateTax([
      entry({
        amount: 2_000_000,
        type: 'in',
        category: EMPLOYMENT_INCOME_CATEGORY,
      }),
    ])
    expect(tax.selfEmploymentIncome).toBe(0)
    expect(tax.selfEmploymentProfit).toBe(0)
    // Full employment amount reaches income tax (minus PA only) — no £1k skim
    expect(tax.totalIncome).toBe(2_000_000)
    expect(tax.taxableIncome).toBe(2_000_000 - PERSONAL_ALLOWANCE_PENCE)
    expect(tax.class4NI).toBe(0)
  })
})
