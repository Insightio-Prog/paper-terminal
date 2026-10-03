import { formatPence } from "../../lib/money";
import type { Invoice, InvoiceStatus } from "../../types/invoice.types";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    draft: "bg-bg-inset text-ink-faint",
    sent: "bg-[#DBEAFE] text-[#1D4ED8]",
    overdue: "bg-[#FEE2E2] text-[#B91C1C]",
    paid: "bg-[#EAF2E9] text-income",
  };

  return (
    <span
      className={`inline-block rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${styles[status]}`}
    >
      {status}
    </span>
  );
}

interface InvoiceListViewProps {
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onNewInvoice: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  invoices: Invoice[];
}

export function InvoiceListView({
  statusFilter,
  onStatusFilterChange,
  onNewInvoice,
  onSelectInvoice,
  invoices,
}: InvoiceListViewProps) {
  const filtered =
    statusFilter === "all"
      ? invoices
      : invoices.filter((invoice) => invoice.status === statusFilter);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Invoicing
        </h1>
        <button
          type="button"
          onClick={onNewInvoice}
          className="rounded-sm bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-bg transition-colors duration-150 hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          New Invoice +
        </button>
      </div>

      <div className="flex shrink-0 gap-4 border-b border-border px-4">
        {STATUS_FILTERS.map((tab) => {
          const isActive = statusFilter === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusFilterChange(tab.key)}
              className={[
                "border-b-2 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150",
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center font-mono text-[13px] text-ink-faint">
            No invoices yet. Hit NEW INVOICE + to create one.
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-[13px]">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr className="border-b border-border">
                {[
                  "Invoice",
                  "Client",
                  "Issued",
                  "Due",
                  "Total",
                  "Status",
                ].map((label) => (
                  <th
                    key={label}
                    className={[
                      "h-9 px-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-secondary",
                      label === "Total" ? "text-right" : "",
                    ].join(" ")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => onSelectInvoice(invoice.id)}
                  className="h-9 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-bg-raised"
                >
                  <td className="px-4 font-medium text-ink">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 text-ink">{invoice.client_name}</td>
                  <td className="px-4 text-ink-faint">
                    {formatDisplayDate(invoice.issue_date)}
                  </td>
                  <td className="px-4 text-ink-faint">
                    {formatDisplayDate(invoice.due_date)}
                  </td>
                  <td className="px-4 text-right tabular-nums text-ink">
                    {formatPence(invoice.total)}
                  </td>
                  <td className="px-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export { StatusBadge };
