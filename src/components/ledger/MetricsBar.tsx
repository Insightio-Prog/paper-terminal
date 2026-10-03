import { useState } from "react";
import { formatPence } from "../../lib/money";
import {
  PERSONAL_ALLOWANCE_PENCE,
  type TaxBreakdown,
} from "../../lib/taxCalc";

interface MetricProps {
  label: string;
  value: string;
  valueClass: string;
  hint?: string;
}

function Metric({ label, value, valueClass, hint }: MetricProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
        {label}
      </span>
      <span
        className={`font-mono text-[20px] tabular-nums leading-none ${valueClass}`}
      >
        {value}
      </span>
      {hint ? (
        <span className="font-mono text-[10px] text-ink-faint">{hint}</span>
      ) : null}
    </div>
  );
}

interface BreakdownLineProps {
  label: string;
  value: string;
}

function BreakdownLine({ label, value }: BreakdownLineProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 font-mono text-[12px]">
      <span className="text-ink-secondary">{label}</span>
      <span className="shrink-0 tabular-nums text-ink">{value}</span>
    </div>
  );
}

function BreakdownSeparator() {
  return (
    <p className="font-mono text-[12px] leading-none text-ink-faint">
      {"─".repeat(40)}
    </p>
  );
}

function formatDeduction(pence: number): string {
  return `−${formatPence(pence)}`;
}

function displaySelfAssessmentOwed(pence: number): string {
  return formatPence(Math.max(0, pence));
}

interface MetricsBarProps {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  tax: TaxBreakdown;
}

export function MetricsBar({
  totalIncome,
  totalExpenses,
  netProfit,
  tax,
}: MetricsBarProps) {
  const [expanded, setExpanded] = useState(false);

  const payeHint =
    tax.payeTaxOverride > 0 ? "(from payslip)" : "(estimated)";

  return (
    <div className="shrink-0 border-b border-border">
      <div className="grid grid-cols-3 gap-4 px-4 py-3">
        <Metric
          label="Total Income"
          value={formatPence(totalIncome)}
          valueClass="text-income"
        />
        <Metric
          label="Total Expenses"
          value={formatPence(totalExpenses)}
          valueClass="text-expense"
        />
        <Metric
          label="Net Profit"
          value={formatPence(netProfit)}
          valueClass="text-ink"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-border px-4 py-3">
        <Metric
          label="Self Assessment Owed"
          value={displaySelfAssessmentOwed(tax.selfAssessmentOwed)}
          valueClass="text-warn"
        />
        <Metric
          label="Total Tax Liability"
          value={formatPence(tax.totalLiability)}
          valueClass="text-ink"
        />
        <Metric
          label="PAYE Credit"
          value={formatPence(tax.payeTaxCredit)}
          valueClass="text-ink"
          hint={payeHint}
        />
      </div>

      <div className="border-t border-border px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="font-mono text-[12px] text-ink-faint transition-colors duration-150 hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          aria-expanded={expanded}
        >
          ❯ How is this calculated?
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-border bg-bg-inset px-4 py-3">
          <BreakdownLine
            label="Employment income:"
            value={formatPence(tax.employmentIncome)}
          />
          <BreakdownLine
            label="Self-employment income:"
            value={formatPence(tax.selfEmploymentIncome)}
          />
          <BreakdownLine
            label="Total expenses:"
            value={formatPence(tax.totalExpenses)}
          />

          <BreakdownSeparator />

          <BreakdownLine
            label="Net income:"
            value={formatPence(tax.totalIncome)}
          />
          <BreakdownLine
            label="Less personal allowance:"
            value={formatDeduction(PERSONAL_ALLOWANCE_PENCE)}
          />

          <BreakdownSeparator />

          <BreakdownLine
            label="Taxable income:"
            value={formatPence(tax.taxableIncome)}
          />
          <BreakdownLine
            label="Income tax (20%):"
            value={formatPence(tax.totalIncomeTax)}
          />
          <BreakdownLine
            label="Class 4 NI (9%):"
            value={formatPence(tax.class4NI)}
          />

          <BreakdownSeparator />

          <BreakdownLine
            label="Total liability:"
            value={formatPence(tax.totalLiability)}
          />
          <BreakdownLine
            label="Less PAYE credit:"
            value={formatDeduction(tax.payeTaxCredit)}
          />

          <BreakdownSeparator />

          <BreakdownLine
            label="Self Assessment owed:"
            value={displaySelfAssessmentOwed(tax.selfAssessmentOwed)}
          />

          <p className="pt-2 font-mono text-[11px] text-ink-faint">
            This is an estimate. Consult an accountant for your actual
            liability.
          </p>
        </div>
      )}
    </div>
  );
}
