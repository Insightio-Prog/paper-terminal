import {
  EMPLOYMENT_INCOME_CATEGORY,
  type LedgerEntry,
} from "../types/ledger.types";

const PERSONAL_ALLOWANCE = 1_257_000;
export const PERSONAL_ALLOWANCE_PENCE = PERSONAL_ALLOWANCE;
/** UK trading allowance — £1,000 in pence (self-employment only). */
export const TRADING_ALLOWANCE_PENCE = 100_000;
const BASIC_RATE_BAND = 3_770_000;
const BASIC_RATE = 0.2;
const HIGHER_RATE = 0.4;
const NI_LOWER_LIMIT = 1_257_000;
const NI_UPPER_LIMIT = 5_027_000;
const NI_BASIC_RATE = 0.09;
const NI_HIGHER_RATE = 0.02;

export interface TaxBreakdown {
  employmentIncome: number;
  selfEmploymentIncome: number;
  totalExpenses: number;
  selfEmploymentProfit: number;
  totalIncome: number;
  taxableIncome: number;
  basicRateTax: number;
  higherRateTax: number;
  totalIncomeTax: number;
  class4NI: number;
  totalLiability: number;
  estimatedPayeTax: number;
  payeTaxOverride: number;
  payeTaxCredit: number;
  selfAssessmentOwed: number;
}

function calculateIncomeTaxOnAmount(income: number): {
  taxableIncome: number;
  basicRateTax: number;
  higherRateTax: number;
  totalIncomeTax: number;
} {
  const taxableIncome = Math.max(0, income - PERSONAL_ALLOWANCE);
  const basicRateTax = Math.round(
    Math.min(taxableIncome, BASIC_RATE_BAND) * BASIC_RATE,
  );
  const higherRateTax = Math.round(
    Math.max(0, taxableIncome - BASIC_RATE_BAND) * HIGHER_RATE,
  );

  return {
    taxableIncome,
    basicRateTax,
    higherRateTax,
    totalIncomeTax: basicRateTax + higherRateTax,
  };
}

function calculateClass4NI(profit: number): number {
  if (profit <= NI_LOWER_LIMIT) {
    return 0;
  }

  const basicBandAmount = Math.min(profit, NI_UPPER_LIMIT) - NI_LOWER_LIMIT;
  const basicNI = basicBandAmount * NI_BASIC_RATE;
  const higherNI = Math.max(0, profit - NI_UPPER_LIMIT) * NI_HIGHER_RATE;

  return Math.round(basicNI + higherNI);
}

export function calculateTax(
  entries: LedgerEntry[],
  payeTaxOverride = 0,
): TaxBreakdown {
  let employmentIncome = 0;
  let selfEmploymentIncome = 0;
  let totalExpenses = 0;

  for (const entry of entries) {
    if (entry.type === "out") {
      totalExpenses += entry.amount;
      continue;
    }

    if (entry.category === EMPLOYMENT_INCOME_CATEGORY) {
      employmentIncome += entry.amount;
    } else {
      selfEmploymentIncome += entry.amount;
    }
  }

  // -----------------------------------------------------------------
  // UK £1,000 trading allowance (self-employment only)
  //
  // Gross SE turnover ≤ £1,000: the whole SE activity is ignored for
  // tax this year (profit treated as £0) — no income tax or Class 4 NI
  // on it. Employment / PAYE income is unaffected.
  //
  // Gross SE turnover > £1,000: claim EITHER actual allowable expenses
  // OR the flat £1,000 allowance — never both. This estimate picks
  // whichever deduction is larger (lower taxable profit), which is what
  // a rational trader would choose.
  //
  // The resulting SE profit then feeds personal allowance, tax bands,
  // and Class 4 NI exactly as before. Allowance does not change those
  // thresholds; it only changes the SE profit figure they see.
  //
  // DECISION (27 Jul 2026): a self-employment trading loss floors
  // selfEmploymentProfit at 0 and does NOT offset employment (PAYE)
  // income elsewhere in totalIncome. This is a deliberate simplification
  // for an ESTIMATE tool, not a full loss-relief model — real HMRC loss
  // relief against other income requires an explicit claim/election and
  // is not automatic. Revisit if the estimate needs to model loss relief
  // more precisely. See HANDOFF.md for the decision context.
  // -----------------------------------------------------------------
  let selfEmploymentProfit = 0;
  if (selfEmploymentIncome > 0) {
    if (selfEmploymentIncome <= TRADING_ALLOWANCE_PENCE) {
      selfEmploymentProfit = 0;
    } else {
      const expenseDeduction = totalExpenses;
      const allowanceDeduction = TRADING_ALLOWANCE_PENCE;
      const chosenDeduction = Math.max(expenseDeduction, allowanceDeduction);
      selfEmploymentProfit = Math.max(
        0,
        selfEmploymentIncome - chosenDeduction,
      );
    }
  }

  // Employment + adjusted SE profit (expenses already reflected in the
  // chosen deduction above — do not subtract totalExpenses again).
  const totalIncome = employmentIncome + selfEmploymentProfit;

  const incomeTax = calculateIncomeTaxOnAmount(totalIncome);
  const class4NI = calculateClass4NI(selfEmploymentProfit);
  const totalLiability = incomeTax.totalIncomeTax + class4NI;

  const estimatedPayeTax = calculateIncomeTaxOnAmount(
    employmentIncome,
  ).totalIncomeTax;
  const payeTaxCredit =
    payeTaxOverride > 0 ? payeTaxOverride : estimatedPayeTax;
  const selfAssessmentOwed = Math.max(0, totalLiability - payeTaxCredit);

  return {
    employmentIncome,
    selfEmploymentIncome,
    totalExpenses,
    selfEmploymentProfit,
    totalIncome,
    taxableIncome: incomeTax.taxableIncome,
    basicRateTax: incomeTax.basicRateTax,
    higherRateTax: incomeTax.higherRateTax,
    totalIncomeTax: incomeTax.totalIncomeTax,
    class4NI,
    totalLiability,
    estimatedPayeTax,
    payeTaxOverride,
    payeTaxCredit,
    selfAssessmentOwed,
  };
}
