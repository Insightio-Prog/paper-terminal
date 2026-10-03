import { useEffect, useRef, useState } from "react";
import { generateInvoicePdf } from "../../lib/generateInvoicePdf";
import { formatPence, parsePoundsToPence, penceToPoundsString } from "../../lib/money";
import { type Contact, useContactStore } from "../../stores/contactStore";
import {
  createDraftInvoice,
  recalcInvoiceTotals,
  recalcLineItem,
  useInvoiceStore,
} from "../../stores/invoiceStore";
import { useProfileStore } from "../../stores/profileStore";
import type { BusinessProfile } from "../../stores/profileStore";
import type { Invoice, LineItem } from "../../types/invoice.types";
import { StatusBadge } from "./InvoiceListView";
import {
  invoiceDestructiveButtonClass,
  invoiceGhostButtonClass,
  invoiceInputClass,
  invoicePrimaryButtonClass,
  invoiceTextareaClass,
} from "./invoicingStyles";

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
      {children}
    </label>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
      {children}
    </h2>
  );
}

function profileFromStore(): BusinessProfile {
  const state = useProfileStore.getState();
  return {
    business_name: state.business_name,
    owner_name: state.owner_name,
    address: state.address,
    email: state.email,
    phone: state.phone,
    website: state.website,
    vat_number: state.vat_number,
    accent_colour: state.accent_colour,
    default_payment_terms: state.default_payment_terms,
    default_notes: state.default_notes,
    logo_path: state.logo_path,
    paye_tax_paid: state.paye_tax_paid,
    follow_up_template: state.follow_up_template,
    auto_log_subscription: state.auto_log_subscription,
    briefing_cache: state.briefing_cache,
    briefing_date: state.briefing_date,
    updated_at: state.updated_at,
  };
}

function UnitPriceInput({
  item,
  onCommit,
}: {
  item: LineItem;
  onCommit: (id: string, unitPrice: number) => void;
}) {
  const [display, setDisplay] = useState(() =>
    penceToPoundsString(item.unit_price),
  );

  useEffect(() => {
    setDisplay(penceToPoundsString(item.unit_price));
  }, [item.unit_price]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        const pence = parsePoundsToPence(display);
        const next = pence ?? 0;
        setDisplay(penceToPoundsString(next));
        onCommit(item.id, next);
      }}
      className={`${invoiceInputClass} w-full text-right tabular-nums`}
    />
  );
}

interface CrmContactPickerProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
}

function CrmContactPicker({ contacts, onSelect }: CrmContactPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleSelect(contact: Contact) {
    onSelect(contact);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={invoiceGhostButtonClass}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        ❯ Select client
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="CRM contacts"
          className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full min-w-[240px] overflow-auto rounded-sm border border-border bg-bg-inset"
        >
          {contacts.length === 0 ? (
            <p className="px-3 py-2 font-mono text-[12px] text-ink-faint">
              No contacts in CRM yet.
            </p>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                role="option"
                onClick={() => handleSelect(contact)}
                className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left transition-colors duration-150 last:border-b-0 hover:bg-bg-raised"
              >
                <span className="font-mono text-[13px] text-ink">
                  {contact.name}
                </span>
                {contact.company && (
                  <span className="font-mono text-[12px] text-ink-faint">
                    {contact.company}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function InvoiceDetail() {
  const activeInvoice = useInvoiceStore((s) => s.activeInvoice);
  const invoices = useInvoiceStore((s) => s.invoices);
  const setActiveInvoice = useInvoiceStore((s) => s.setActiveInvoice);
  const createInvoice = useInvoiceStore((s) => s.createInvoice);
  const updateInvoice = useInvoiceStore((s) => s.updateInvoice);
  const deleteInvoice = useInvoiceStore((s) => s.deleteInvoice);
  const markAsSent = useInvoiceStore((s) => s.markAsSent);
  const markAsPaid = useInvoiceStore((s) => s.markAsPaid);
  const contacts = useContactStore((s) => s.contacts);
  const loadContacts = useContactStore((s) => s.loadContacts);

  const [form, setForm] = useState<Invoice>(
    () => activeInvoice ?? createDraftInvoice(),
  );
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isNew = !form.id;

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!activeInvoice) return;
    setForm(activeInvoice);
  }, [activeInvoice]);

  useEffect(() => {
    if (!isNew) {
      const refreshed = invoices.find((invoice) => invoice.id === form.id);
      if (refreshed) {
        setForm(refreshed);
      }
    }
  }, [invoices, form.id, isNew]);

  function updateForm(updates: Partial<Invoice>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function applyContactSnapshot(contact: Contact) {
    // One-way snapshot: name always copied; company/email/address set when present,
    // cleared when absent so the invoice client block stays consistent.
    updateForm({
      client_name: contact.name,
      client_company: contact.company?.trim() ?? "",
      client_email: contact.email?.trim() ?? "",
      client_address: contact.address?.trim() ?? "",
    });
  }

  function updateLineItem(id: string, updates: Partial<LineItem>) {
    setForm((current) => {
      const lineItems = current.line_items.map((item) =>
        item.id === id ? recalcLineItem({ ...item, ...updates }) : item,
      );
      const totals = recalcInvoiceTotals(lineItems);
      return { ...current, line_items: lineItems, ...totals };
    });
  }

  function addLineItem() {
    setForm((current) => {
      const lineItems = [
        ...current.line_items,
        recalcLineItem({
          id: crypto.randomUUID(),
          description: "",
          quantity: 1,
          unit_price: 0,
          amount: 0,
        }),
      ];
      const totals = recalcInvoiceTotals(lineItems);
      return { ...current, line_items: lineItems, ...totals };
    });
  }

  function removeLineItem(id: string) {
    setForm((current) => {
      const lineItems = current.line_items.filter((item) => item.id !== id);
      const totals = recalcInvoiceTotals(lineItems);
      return { ...current, line_items: lineItems, ...totals };
    });
  }

  function handleBack() {
    setActiveInvoice(null);
  }

  async function handleSave() {
    const payload = {
      client_name: form.client_name.trim(),
      client_company: form.client_company.trim(),
      client_email: form.client_email.trim(),
      client_address: form.client_address.trim(),
      issue_date: form.issue_date,
      due_date: form.due_date,
      line_items: form.line_items,
      subtotal: form.subtotal,
      total: form.total,
      status: form.status,
      notes: form.notes,
      payment_terms: form.payment_terms,
    };

    if (!payload.client_name) return;

    if (isNew) {
      await createInvoice(payload);
    } else {
      await updateInvoice(form.id, payload);
    }

    setActiveInvoice(null);
  }

  async function handleDelete() {
    if (isNew) {
      setActiveInvoice(null);
      return;
    }

    await deleteInvoice(form.id);
    setActiveInvoice(null);
  }

  async function handleMarkSent() {
    await markAsSent(form.id);
  }

  async function handleMarkPaid() {
    await markAsPaid(form.id);
  }

  async function handleDownloadPdf() {
    setGeneratingPdf(true);
    try {
      await generateInvoicePdf(form, profileFromStore());
    } finally {
      setGeneratingPdf(false);
    }
  }

  const downloadPdfButton = !isNew ? (
    <button
      type="button"
      onClick={() => void handleDownloadPdf()}
      disabled={generatingPdf}
      className={`${invoiceGhostButtonClass}${generatingPdf ? " opacity-50" : ""}`}
    >
      {generatingPdf ? "Generating..." : "Download PDF"}
    </button>
  ) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={handleBack}
          className={invoiceGhostButtonClass}
        >
          ← Back
        </button>

        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          {isNew ? "New Invoice" : form.invoice_number}
        </h1>

        <div className="flex items-center gap-2">
          {form.status === "draft" && (
            <>
              <button
                type="button"
                onClick={() => void handleMarkSent()}
                disabled={isNew}
                className={invoiceGhostButtonClass}
              >
                Mark as Sent
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className={invoiceDestructiveButtonClass}
              >
                Delete
              </button>
              {downloadPdfButton}
            </>
          )}
          {(form.status === "sent" || form.status === "overdue") && (
            <>
              <button
                type="button"
                onClick={() => void handleMarkPaid()}
                disabled={isNew}
                className={invoicePrimaryButtonClass}
              >
                Mark as Paid
              </button>
              {downloadPdfButton}
            </>
          )}
          {form.status === "paid" && downloadPdfButton}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-6">
          <section className="space-y-3">
            <SectionLabel>Client</SectionLabel>
            <CrmContactPicker
              contacts={contacts}
              onSelect={applyContactSnapshot}
            />
            <div>
              <FieldLabel>Client name</FieldLabel>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => updateForm({ client_name: e.target.value })}
                className={`${invoiceInputClass} w-full`}
              />
            </div>
            <div>
              <FieldLabel>Company</FieldLabel>
              <input
                type="text"
                value={form.client_company}
                onChange={(e) => updateForm({ client_company: e.target.value })}
                className={`${invoiceInputClass} w-full`}
              />
            </div>
            <div>
              <FieldLabel>Client email</FieldLabel>
              <input
                type="email"
                value={form.client_email}
                onChange={(e) => updateForm({ client_email: e.target.value })}
                className={`${invoiceInputClass} w-full`}
              />
            </div>
            <div>
              <FieldLabel>Client address</FieldLabel>
              <textarea
                rows={3}
                value={form.client_address}
                onChange={(e) => updateForm({ client_address: e.target.value })}
                className={invoiceTextareaClass}
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>Invoice</SectionLabel>
            <div>
              <FieldLabel>Invoice number</FieldLabel>
              <input
                type="text"
                readOnly
                value={isNew ? "Assigned on save" : form.invoice_number}
                className={`${invoiceInputClass} w-full text-ink-faint`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Issue date</FieldLabel>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => updateForm({ issue_date: e.target.value })}
                  className={`${invoiceInputClass} w-full`}
                />
              </div>
              <div>
                <FieldLabel>Due date</FieldLabel>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => updateForm({ due_date: e.target.value })}
                  className={`${invoiceInputClass} w-full`}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <div>
                <StatusBadge status={form.status} />
              </div>
            </div>
          </section>
        </div>

        <div className="my-6 border-b border-border" />

        <section className="space-y-3">
          <SectionLabel>Line Items</SectionLabel>

          <table className="w-full border-collapse font-mono text-[13px]">
            <thead>
              <tr className="border-b border-border">
                {["Description", "Qty", "Unit Price", "Amount", ""].map(
                  (label) => (
                    <th
                      key={label || "actions"}
                      className={[
                        "h-9 px-2 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-secondary",
                        label === "Amount" ? "text-right" : "",
                        label === "" ? "w-8" : "",
                      ].join(" ")}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {form.line_items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, {
                          description: e.target.value,
                        })
                      }
                      className={`${invoiceInputClass} w-full`}
                    />
                  </td>
                  <td className="w-[72px] px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(item.id, {
                          quantity: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                      className={`${invoiceInputClass} w-full tabular-nums`}
                    />
                  </td>
                  <td className="w-[108px] px-2 py-1">
                    <UnitPriceInput
                      item={item}
                      onCommit={(id, unitPrice) =>
                        updateLineItem(id, { unit_price: unitPrice })
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-ink">
                    {formatPence(item.amount)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      aria-label="Remove line item"
                      className={invoiceDestructiveButtonClass}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={addLineItem}
            className={invoiceGhostButtonClass}
          >
            + Add line item
          </button>

          <div className="space-y-1 text-right font-mono text-[13px]">
            <p className="tabular-nums text-ink-secondary">
              Subtotal {formatPence(form.subtotal)}
            </p>
            <p className="tabular-nums text-ink">
              Total {formatPence(form.total)}
            </p>
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-3">
          <SectionLabel>Notes & Payment Terms</SectionLabel>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => updateForm({ notes: e.target.value })}
            className={invoiceTextareaClass}
          />
        </section>
      </div>

      <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          className={invoicePrimaryButtonClass}
        >
          Save Invoice
        </button>
      </div>
    </div>
  );
}
