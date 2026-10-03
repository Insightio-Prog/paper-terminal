import { useState, type FormEvent } from "react";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type EntryType,
  useLedgerStore,
} from "../../stores/ledgerStore";
import { parsePoundsToPence } from "../../lib/money";
import { EntryTypeToggle } from "./EntryTypeToggle";
import { ledgerInputClass, ledgerSelectClass } from "./ledgerStyles";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddEntryForm() {
  const addEntry = useLedgerStore((s) => s.addEntry);

  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<EntryType>("in");
  const [error, setError] = useState<string | null>(null);

  const categories =
    type === "in" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function handleTypeChange(next: EntryType) {
    setType(next);
    setCategory(
      next === "in" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
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

    addEntry({
      date,
      description: trimmedDescription,
      category,
      amount: pence,
      type,
    });

    setDescription("");
    setAmount("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-border bg-bg-raised"
    >
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={`${ledgerInputClass} w-[130px] shrink-0`}
        />

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="description"
          aria-label="Description"
          className={`${ledgerInputClass} min-w-[120px] flex-1`}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className={`${ledgerSelectClass} max-w-[180px] shrink-0`}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          aria-label="Amount in pounds"
          className={`${ledgerInputClass} w-[80px] shrink-0 text-right tabular-nums`}
        />

        <EntryTypeToggle type={type} onChange={handleTypeChange} />

        <button
          type="submit"
          className="shrink-0 rounded-sm border border-accent bg-bg-inset px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-ink transition-colors duration-150 hover:bg-bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="px-3 pb-2 font-mono text-[11px] text-expense">{error}</p>
      )}
    </form>
  );
}
