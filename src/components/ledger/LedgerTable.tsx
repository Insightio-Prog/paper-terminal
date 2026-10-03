import { useMemo, useState } from "react";
import type { LedgerEntry } from "../../stores/ledgerStore";
import { LedgerTableRow } from "./LedgerTableRow";

interface LedgerTableProps {
  entries: LedgerEntry[];
  balances: Map<string, number>;
  onUpdateEntry: (
    id: string,
    updates: Omit<LedgerEntry, "id" | "taxYear">,
  ) => void;
  onDeleteEntry: (entry: LedgerEntry) => void;
}

const COLUMNS = [
  { key: "date", label: "Date", align: "left" as const },
  { key: "description", label: "Description", align: "left" as const },
  { key: "category", label: "Category", align: "left" as const },
  { key: "amount", label: "Amount", align: "right" as const },
  { key: "type", label: "Type", align: "left" as const },
  { key: "balance", label: "Balance", align: "right" as const },
  { key: "actions", label: "", align: "right" as const },
];

export function LedgerTable({
  entries,
  balances,
  onUpdateEntry,
  onDeleteEntry,
}: LedgerTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEmpty = entries.length === 0;

  const rows = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        balance: balances.get(entry.id) ?? 0,
      })),
    [entries, balances],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[13px]">
          <thead className="sticky top-0 z-10 bg-bg">
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={[
                    "h-9 px-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-secondary",
                    col.align === "right" ? "text-right" : "text-left",
                    col.key === "actions" ? "w-8 px-2" : "",
                  ].join(" ")}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-12 text-center font-mono text-[13px] text-ink-faint"
                >
                  no entries yet — add one
                  below or ask claude
                </td>
              </tr>
            ) : (
              rows.map(({ entry, balance }) => (
                <LedgerTableRow
                  key={entry.id}
                  entry={entry}
                  balance={balance}
                  isEditing={editingId === entry.id}
                  onStartEdit={() => setEditingId(entry.id)}
                  onSave={(updates) => {
                    onUpdateEntry(entry.id, updates);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => {
                    if (editingId === entry.id) {
                      setEditingId(null);
                    }
                    onDeleteEntry(entry);
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
