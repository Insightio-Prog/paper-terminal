import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import {
  formatPence,
  parsePoundsToPence,
  penceToPoundsString,
} from "../../lib/money";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type EntryType,
  type LedgerEntry,
  type LedgerEntryUpdate,
} from "../../stores/ledgerStore";
import { ReceiptImageModal } from "../receipts/ReceiptImageModal";
import { EntryTypeToggle } from "./EntryTypeToggle";
import { ledgerInputClass, ledgerSelectClass } from "./ledgerStyles";

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

interface LedgerTableRowProps {
  entry: LedgerEntry;
  balance: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: LedgerEntryUpdate) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function LedgerTableRow({
  entry,
  balance,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: LedgerTableRowProps) {
  const [date, setDate] = useState(entry.date);
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(entry.category);
  const [amount, setAmount] = useState(penceToPoundsString(entry.amount));
  const [type, setType] = useState<EntryType>(entry.type);
  const [error, setError] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setDate(entry.date);
      setDescription(entry.description);
      setCategory(entry.category);
      setAmount(penceToPoundsString(entry.amount));
      setType(entry.type);
      setError(null);
    }
  }, [isEditing, entry]);

  const categories = type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function handleTypeChange(next: EntryType) {
    setType(next);
    const nextCategories =
      next === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!(nextCategories as readonly string[]).includes(category)) {
      setCategory(nextCategories[0]);
    }
  }

  function handleSave() {
    setError(null);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError("description required");
      return;
    }

    const pence = parsePoundsToPence(amount);
    if (pence === null || pence === 0) {
      setError("enter a valid amount");
      return;
    }

    onSave({
      date,
      description: trimmedDescription,
      category,
      amount: pence,
      type,
      receiptImagePath: entry.receiptImagePath ?? null,
    });
  }

  if (isEditing) {
    return (
      <>
        <tr className="border-b border-border bg-bg-raised">
          <td className="px-2 py-1">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className={`${ledgerInputClass} w-full min-w-[120px]`}
            />
          </td>
          <td className="px-2 py-1">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Description"
              className={`${ledgerInputClass} w-full min-w-[120px]`}
            />
          </td>
          <td className="px-2 py-1">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
              className={`${ledgerSelectClass} w-full min-w-[120px]`}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </td>
          <td className="px-2 py-1">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount in pounds"
              className={`${ledgerInputClass} w-full min-w-[72px] text-right tabular-nums`}
            />
          </td>
          <td className="px-2 py-1">
            <EntryTypeToggle type={type} onChange={handleTypeChange} />
          </td>
          <td className="px-3 text-right tabular-nums text-ink-faint">
            {formatPence(balance)}
          </td>
          <td className="px-2 py-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSave}
                className="shrink-0 rounded-sm border border-accent bg-bg-inset px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink transition-colors duration-150 hover:bg-bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
        {error && (
          <tr className="border-b border-border bg-bg-raised">
            <td
              colSpan={7}
              className="px-3 pb-2 font-mono text-[11px] text-expense"
            >
              {error}
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <tr
      onClick={onStartEdit}
      className="group h-9 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-bg-raised"
    >
      <td className="px-3 text-ink">{formatDisplayDate(entry.date)}</td>
      <td className="max-w-[240px] px-3 text-ink">
        <span className="inline-flex max-w-full items-center gap-1.5">
          {entry.receiptImagePath ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setReceiptOpen(true);
              }}
              aria-label="View receipt"
              title="View receipt"
              className="inline-flex shrink-0 items-center justify-center text-ink-secondary transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Camera className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <span className="min-w-0 truncate">{entry.description}</span>
        </span>
        {entry.receiptImagePath ? (
          <ReceiptImageModal
            open={receiptOpen}
            entry={entry}
            onClose={() => setReceiptOpen(false)}
          />
        ) : null}
      </td>
      <td className="px-3 text-ink-secondary">{entry.category}</td>
      <td
        className={[
          "px-3 text-right tabular-nums",
          entry.type === "in" ? "text-income" : "text-expense",
        ].join(" ")}
      >
        {formatPence(entry.amount)}
      </td>
      <td className="px-3 uppercase text-ink-secondary">
        {entry.type === "in" ? "IN" : "OUT"}
      </td>
      <td className="px-3 text-right tabular-nums text-ink">
        {formatPence(balance)}
      </td>
      <td className="w-8 px-2 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Delete entry"
          className="inline-flex size-6 items-center justify-center font-mono text-[16px] leading-none text-ink-faint opacity-0 transition-opacity duration-150 hover:text-expense group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
