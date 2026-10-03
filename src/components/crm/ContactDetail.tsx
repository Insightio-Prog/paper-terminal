import { useEffect, useState } from "react";
import {
  createDraftInvoice,
  useInvoiceStore,
} from "../../stores/invoiceStore";
import { useNavigationStore } from "../../stores/navigationStore";
import {
  type Contact,
  type ContactInput,
  useContactStore,
} from "../../stores/contactStore";
import {
  crmAccentActionClass,
  crmDestructiveButtonClass,
  crmGhostButtonClass,
  crmInputClass,
  crmPrimaryButtonClass,
  crmTextareaClass,
} from "./crmStyles";

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

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function contactToForm(contact: Contact): ContactInput {
  return {
    name: contact.name,
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    notes: contact.notes,
  };
}

interface ContactDetailProps {
  contact: Contact | null;
  onClose: () => void;
}

export function ContactDetail({ contact, onClose }: ContactDetailProps) {
  const contacts = useContactStore((s) => s.contacts);
  const addContact = useContactStore((s) => s.addContact);
  const updateContact = useContactStore((s) => s.updateContact);
  const deleteContact = useContactStore((s) => s.deleteContact);

  const isNew = contact === null;
  const contactId = contact?.id;

  const [form, setForm] = useState<ContactInput>(() =>
    contact ? contactToForm(contact) : {
      name: "",
      company: null,
      email: null,
      phone: null,
      address: null,
      notes: null,
    },
  );

  useEffect(() => {
    if (!contact) return;
    setForm(contactToForm(contact));
  }, [contact]);

  useEffect(() => {
    if (isNew || contactId === undefined) return;
    const refreshed = contacts.find((item) => item.id === contactId);
    if (refreshed) {
      setForm(contactToForm(refreshed));
    }
  }, [contacts, contactId, isNew]);

  function updateForm(updates: Partial<ContactInput>) {
    setForm((current) => ({ ...current, ...updates }));
  }

  function buildPayload(): ContactInput {
    return {
      name: form.name.trim(),
      company: toNullable(form.company ?? ""),
      email: toNullable(form.email ?? ""),
      phone: toNullable(form.phone ?? ""),
      address: toNullable(form.address ?? ""),
      notes: toNullable(form.notes ?? ""),
    };
  }

  const nameMissing = form.name.trim() === "";

  async function handleSave() {
    const payload = buildPayload();
    if (!payload.name) return;

    if (isNew) {
      await addContact(payload);
    } else {
      await updateContact(contact.id, payload);
    }

    onClose();
  }

  async function handleDelete() {
    if (isNew) {
      onClose();
      return;
    }

    await deleteContact(contact.id);
    onClose();
  }

  function buildContactSnapshot() {
    const payload = buildPayload();
    return {
      client_name: payload.name,
      client_company: payload.company?.trim() ?? "",
      client_email: payload.email?.trim() ?? "",
      client_address: payload.address?.trim() ?? "",
    };
  }

  function handleCreateInvoice() {
    const snapshot = buildContactSnapshot();
    const draft = {
      ...createDraftInvoice(),
      ...snapshot,
    };

    useInvoiceStore.getState().setActiveInvoice(draft);
    useNavigationStore.getState().setActiveView("invoicing");
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <button type="button" onClick={onClose} className={crmGhostButtonClass}>
          ← Back
        </button>

        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          {isNew ? "New Contact" : contact.name}
        </h1>

        <div className="w-16" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <section className="space-y-3">
          <SectionLabel>Details</SectionLabel>

          <div>
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              className={`${crmInputClass} w-full`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Company</FieldLabel>
              <input
                type="text"
                value={form.company ?? ""}
                onChange={(e) => updateForm({ company: e.target.value })}
                className={`${crmInputClass} w-full`}
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => updateForm({ email: e.target.value })}
                className={`${crmInputClass} w-full`}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Phone</FieldLabel>
            <input
              type="text"
              value={form.phone ?? ""}
              onChange={(e) => updateForm({ phone: e.target.value })}
              className={`${crmInputClass} w-full max-w-sm`}
            />
          </div>

          <div>
            <FieldLabel>Address</FieldLabel>
            <textarea
              rows={3}
              value={form.address ?? ""}
              onChange={(e) => updateForm({ address: e.target.value })}
              className={crmTextareaClass}
            />
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-3">
          <SectionLabel>Notes</SectionLabel>
          <textarea
            rows={6}
            value={form.notes ?? ""}
            onChange={(e) => updateForm({ notes: e.target.value })}
            placeholder="Client context, preferences, project history…"
            className={crmTextareaClass}
          />
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
        {!isNew ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className={crmDestructiveButtonClass}
          >
            Delete
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {nameMissing && (
            <p className="font-mono text-[12px] text-ink-faint">
              Name is required to save.
            </p>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={handleCreateInvoice}
              className={crmAccentActionClass}
            >
              Create Invoice
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={nameMissing}
            className={`${crmPrimaryButtonClass}${nameMissing ? " opacity-50" : ""}`}
          >
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}
