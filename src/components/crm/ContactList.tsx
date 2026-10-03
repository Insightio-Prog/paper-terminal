import { useEffect, useMemo, useState } from "react";
import {
  type Contact,
  useContactStore,
} from "../../stores/contactStore";
import { ContactDetail } from "./ContactDetail";
import { crmInputClass, crmPrimaryButtonClass } from "./crmStyles";

function matchesSearch(contact: Contact, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [contact.name, contact.company, contact.email]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

export function ContactList() {
  const contacts = useContactStore((s) => s.contacts);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const [search, setSearch] = useState("");
  const [activeContact, setActiveContact] = useState<Contact | "new" | null>(
    null,
  );

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const filtered = useMemo(
    () => contacts.filter((contact) => matchesSearch(contact, search)),
    [contacts, search],
  );

  if (activeContact !== null) {
    return (
      <ContactDetail
        contact={activeContact === "new" ? null : activeContact}
        onClose={() => setActiveContact(null)}
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Contacts
        </h1>
        <button
          type="button"
          onClick={() => setActiveContact("new")}
          className={crmPrimaryButtonClass}
        >
          New Contact +
        </button>
      </div>

      <div className="shrink-0 border-b border-border px-4 py-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or email"
          className={`${crmInputClass} w-full max-w-md`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="px-4 py-12 text-center font-mono text-[13px] text-ink-faint">
            <p>❯ No contacts yet</p>
            <p className="mt-2 text-[12px]">
              Hit NEW CONTACT + to add your first one.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center font-mono text-[13px] text-ink-faint">
            No contacts match your search.
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-[13px]">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr className="border-b border-border">
                {["Name", "Company", "Email"].map((label) => (
                  <th
                    key={label}
                    className="h-9 px-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-secondary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => setActiveContact(contact)}
                  className="h-9 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-bg-raised"
                >
                  <td className="px-4 font-medium text-ink">{contact.name}</td>
                  <td className="px-4 text-ink-faint">
                    {contact.company ?? ""}
                  </td>
                  <td className="px-4 text-ink-secondary">
                    {contact.email ?? ""}
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
