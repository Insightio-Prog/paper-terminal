import type { EntryType } from "../../stores/ledgerStore";

interface EntryTypeToggleProps {
  type: EntryType;
  onChange: (type: EntryType) => void;
}

export function EntryTypeToggle({ type, onChange }: EntryTypeToggleProps) {
  return (
    <div
      className="flex shrink-0 rounded-sm border border-border"
      role="group"
      aria-label="Entry type"
    >
      {(["in", "out"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={[
            "px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150",
            type === value
              ? value === "in"
                ? "bg-bg-inset text-income"
                : "bg-bg-inset text-expense"
              : "bg-bg-inset text-ink-faint hover:text-ink-secondary",
          ].join(" ")}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
