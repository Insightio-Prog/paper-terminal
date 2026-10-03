import { useEffect, useMemo, useState } from "react";
import {
  summarizeLedgerPeriod,
  taxYearMonthOptions,
} from "../../lib/ledgerPeriods";
import { taxYearOptions } from "../../lib/taxYear";
import {
  computeBalances,
  computeTotals,
  downloadCsv,
  entriesToCsv,
  type LedgerEntry,
  selectFilteredEntries,
  useLedgerStore,
} from "../../stores/ledgerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useToastStore } from "../../stores/toastStore";
import { AddEntryForm } from "./AddEntryForm";
import { CsvImportModal } from "./import/CsvImportModal";
import { LedgerTable } from "./LedgerTable";
import { MetricsBar } from "./MetricsBar";

const ALL_MONTHS = "";

export function LedgerPage() {
  const entries = useLedgerStore((s) => s.entries);
  const taxYear = useLedgerStore((s) => s.taxYear);
  const setTaxYear = useLedgerStore((s) => s.setTaxYear);
  const loadEntries = useLedgerStore((s) => s.loadEntries);
  const updateEntry = useLedgerStore((s) => s.updateEntry);
  const deleteEntry = useLedgerStore((s) => s.deleteEntry);
  const restoreEntry = useLedgerStore((s) => s.restoreEntry);
  const addToast = useToastStore((s) => s.addToast);

  const [importOpen, setImportOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(ALL_MONTHS);

  const yearOptions = useMemo(() => taxYearOptions(), []);
  const monthOptions = useMemo(() => taxYearMonthOptions(taxYear), [taxYear]);

  const payeTaxPaid = useProfileStore((s) => s.paye_tax_paid);

  const yearEntries = useMemo(
    () => selectFilteredEntries(entries, taxYear),
    [entries, taxYear],
  );

  const selectedMonthOption = useMemo(
    () => monthOptions.find((m) => m.value === selectedMonth) ?? null,
    [monthOptions, selectedMonth],
  );

  const filteredEntries = useMemo(() => {
    if (!selectedMonthOption) return yearEntries;
    return summarizeLedgerPeriod(
      yearEntries,
      selectedMonthOption.start,
      selectedMonthOption.end,
    ).filtered;
  }, [yearEntries, selectedMonthOption]);

  const balances = useMemo(
    () => computeBalances(filteredEntries),
    [filteredEntries],
  );

  const { totalIncome, totalExpenses, netProfit, tax } = useMemo(
    () => computeTotals(filteredEntries, payeTaxPaid),
    [filteredEntries, payeTaxPaid],
  );

  useEffect(() => {
    void loadEntries(taxYear);
  }, [loadEntries, taxYear]);

  async function handleDeleteEntry(entry: LedgerEntry) {
    try {
      await deleteEntry(entry.id);
    } catch {
      // Error toast already shown by ledgerStore
      return;
    }

    addToast({
      message: "entry deleted —",
      action: {
        label: "undo",
        onClick: () => {
          void restoreEntry(entry);
        },
      },
      durationMs: 5000,
    });
  }

  function handleExportCsv() {
    const csv = entriesToCsv(filteredEntries, balances);
    const yearSlug = taxYear.replace("–", "-");
    const filename = selectedMonthOption
      ? `insightio_${yearSlug}_${selectedMonthOption.slug}.csv`
      : `insightio_${yearSlug}.csv`;
    downloadCsv(csv, filename);
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Ledger
        </h1>

        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="tax-year-select">
            Tax year
          </label>
          <select
            id="tax-year-select"
            value={taxYear}
            onChange={(e) => {
              setTaxYear(e.target.value);
              setSelectedMonth(ALL_MONTHS);
            }}
            className="rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[13px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="ledger-month-select">
            Month
          </label>
          <select
            id="ledger-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[13px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value={ALL_MONTHS}>All months</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-sm border border-border bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink transition-colors duration-150 hover:bg-bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            Import CSV
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-sm border border-accent bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent transition-colors duration-150 hover:bg-bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Export CSV
          </button>
        </div>
      </div>

      <MetricsBar
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        netProfit={netProfit}
        tax={tax}
      />

      {/* Table */}
      <LedgerTable
        entries={filteredEntries}
        balances={balances}
        onUpdateEntry={updateEntry}
        onDeleteEntry={handleDeleteEntry}
      />

      {/* Add entry form */}
      <AddEntryForm />

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
