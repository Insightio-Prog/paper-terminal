import { useEffect, useState, type ChangeEvent } from "react";
import { getLogoUrl, importLogo } from "../lib/logo";
import { parsePoundsToPence } from "../lib/money";
import { reportStoreError } from "../stores/toastStore";
import {
  useProfileStore,
  type BusinessProfile,
} from "../stores/profileStore";
import { MockCheckout } from "./billing/MockCheckout";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import {
  settingsGhostButtonClass,
  settingsInputClass,
  settingsTextareaClass,
} from "./settingsStyles";

type ProfileFormState = Omit<BusinessProfile, "updated_at">;

function profileToForm(profile: BusinessProfile): ProfileFormState {
  return {
    business_name: profile.business_name,
    owner_name: profile.owner_name,
    address: profile.address,
    email: profile.email,
    phone: profile.phone,
    website: profile.website,
    vat_number: profile.vat_number,
    accent_colour: profile.accent_colour,
    default_payment_terms: profile.default_payment_terms,
    default_notes: profile.default_notes,
    logo_path: profile.logo_path,
    paye_tax_paid: profile.paye_tax_paid,
    follow_up_template: profile.follow_up_template,
    auto_log_subscription: profile.auto_log_subscription,
    briefing_cache: profile.briefing_cache,
    briefing_date: profile.briefing_date,
  };
}

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

function formatDateLocal(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Settings() {
  const profile = useProfileStore();
  const saveProfile = useProfileStore((s) => s.saveProfile);
  const setLogoPath = useProfileStore((s) => s.setLogoPath);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const cancelSubscription = useSubscriptionStore((s) => s.cancel);

  const [form, setForm] = useState<ProfileFormState>(() =>
    profileToForm(profile),
  );
  const [payeDisplay, setPayeDisplay] = useState(() =>
    (profile.paye_tax_paid / 100).toFixed(2),
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    setForm(profileToForm(profile));
  }, [
    profile.business_name,
    profile.owner_name,
    profile.address,
    profile.email,
    profile.phone,
    profile.website,
    profile.vat_number,
    profile.accent_colour,
    profile.default_payment_terms,
    profile.default_notes,
    profile.logo_path,
    profile.paye_tax_paid,
    profile.follow_up_template,
    profile.auto_log_subscription,
    profile.briefing_cache,
    profile.briefing_date,
    profile.updated_at,
  ]);

  useEffect(() => {
    if (!form.logo_path) {
      setLogoUrl(null);
      return;
    }

    void getLogoUrl(form.logo_path).then(setLogoUrl);
  }, [form.logo_path]);

  useEffect(() => {
    if (!saved) return;

    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    setPayeDisplay((form.paye_tax_paid / 100).toFixed(2));
  }, [form.paye_tax_paid]);

  function updateField<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleLogoUpload() {
    let path: string | null;
    try {
      path = await importLogo();
    } catch (error) {
      reportStoreError("Couldn't upload logo", error);
      return;
    }
    if (!path) return;

    try {
      await setLogoPath(path);
      updateField("logo_path", path);
    } catch {
      // Error toast already shown by profileStore
    }
  }

  async function handleSave() {
    try {
      await saveProfile(form);
      setSaved(true);
    } catch {
      // Error toast already shown by profileStore
    }
  }

  function handlePayeChange(e: ChangeEvent<HTMLInputElement>) {
    setPayeDisplay(e.target.value);
  }

  function handlePayeBlur() {
    // Pre-round to 2dp so typos like "12.999" still become £13.00 (old blur
    // behaviour) without float×100; parsePoundsToPence stays strict globally.
    // Invalid "abc" → Number NaN → "NaN" → parse null → ?? 0 (same fallback).
    const rounded = payeDisplay.trim()
      ? Number(payeDisplay).toFixed(2)
      : payeDisplay;
    const pence = parsePoundsToPence(rounded) ?? 0;
    setPayeDisplay((pence / 100).toFixed(2));
    updateField("paye_tax_paid", pence);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Settings
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <section className="space-y-4">
          <SectionLabel>Business Details</SectionLabel>

          <div>
            <FieldLabel>Business name</FieldLabel>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => updateField("business_name", e.target.value)}
              className={settingsInputClass}
            />
          </div>

          <div>
            <FieldLabel>Your name</FieldLabel>
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => updateField("owner_name", e.target.value)}
              className={settingsInputClass}
            />
          </div>

          <div>
            <FieldLabel>Address</FieldLabel>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className={settingsTextareaClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className={settingsInputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Website</FieldLabel>
              <input
                type="url"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div>
              <FieldLabel>VAT No. (optional)</FieldLabel>
              <input
                type="text"
                value={form.vat_number}
                onChange={(e) => updateField("vat_number", e.target.value)}
                className={settingsInputClass}
              />
            </div>
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-4">
          <SectionLabel>Branding</SectionLabel>

          <div>
            <FieldLabel>Logo</FieldLabel>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Business logo"
                  className="max-h-16 w-auto object-contain"
                />
              )}
              <button
                type="button"
                onClick={() => void handleLogoUpload()}
                className={settingsGhostButtonClass}
              >
                {form.logo_path ? "Change logo" : "Upload logo"}
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>Invoice accent colour</FieldLabel>
            <input
              type="color"
              value={form.accent_colour}
              onChange={(e) => updateField("accent_colour", e.target.value)}
              onBlur={(e) => updateField("accent_colour", e.target.value)}
              className="size-8 cursor-pointer appearance-none rounded-sm border border-border bg-bg-inset p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
            />
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-4">
          <SectionLabel>Tax Settings</SectionLabel>

          <div>
            <FieldLabel>PAYE tax paid this year (from payslip)</FieldLabel>
            <div className="flex max-w-xs items-center gap-2">
              <span className="font-mono text-[13px] text-ink-secondary">£</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={payeDisplay}
                onChange={handlePayeChange}
                onBlur={handlePayeBlur}
                className={`${settingsInputClass} min-w-0 flex-1`}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              Optional — leave at £0 to use the automatic estimate
            </p>
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-4">
          <SectionLabel>Invoice Defaults</SectionLabel>

          <div>
            <FieldLabel>Default payment terms</FieldLabel>
            <input
              type="text"
              value={form.default_payment_terms}
              onChange={(e) =>
                updateField("default_payment_terms", e.target.value)
              }
              className={settingsInputClass}
            />
          </div>

          <div>
            <FieldLabel>Default notes</FieldLabel>
            <textarea
              rows={4}
              value={form.default_notes}
              onChange={(e) => updateField("default_notes", e.target.value)}
              placeholder="Bank details, thank you message, or any standard footer text"
              className={settingsTextareaClass}
            />
          </div>

          <div>
            <FieldLabel>Invoice follow-up template</FieldLabel>
            <textarea
              rows={8}
              value={form.follow_up_template}
              onChange={(e) =>
                updateField("follow_up_template", e.target.value)
              }
              placeholder={
                "Subject: Overdue invoice {invoice_number}\n\nDear {client_name},\n\n..."
              }
              className={settingsTextareaClass}
            />
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              Optional. When set, follow-up emails use this template instead of
              a Claude draft. Available placeholders: {"{client_name}"},{" "}
              {"{invoice_number}"}, {"{amount}"}, {"{due_date}"},{" "}
              {"{days_overdue}"}, {"{business_name}"}. If the first line starts
              with Subject:, it is treated as the subject.
            </p>
          </div>
        </section>

        <div className="my-6 border-b border-border" />

        <section className="space-y-4">
          <SectionLabel>Billing (demo)</SectionLabel>

          {subscription && subscription.status === "trialing" ? (
            <div className="font-mono text-[13px] text-ink">
              <p>Free trial ({subscription.plan})</p>
              <p className="mt-1 text-ink-faint">
                Trial ends {formatDateLocal(subscription.trial_ends)}
              </p>
            </div>
          ) : subscription ? (
            <p className="font-mono text-[13px] text-ink-faint">
              Subscription cancelled.
            </p>
          ) : (
            <p className="font-mono text-[13px] text-ink-faint">
              No subscription. This is a demo, so the app is fully unlocked.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="rounded-sm border border-border bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink transition-colors duration-150 hover:bg-bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              {subscription?.status === "trialing"
                ? "Change plan"
                : "Preview checkout"}
            </button>
            {subscription?.status === "trialing" && (
              <button
                type="button"
                onClick={cancelSubscription}
                className={settingsGhostButtonClass}
              >
                Cancel trial
              </button>
            )}
          </div>
          <p className="font-mono text-[11px] text-ink-faint">
            A mock of the Stripe checkout flow. Nothing is charged and no card
            details are collected.
          </p>
        </section>
      </div>

      {checkoutOpen && <MockCheckout onClose={() => setCheckoutOpen(false)} />}

      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-4 py-3">
        {saved && (
          <span className="font-mono text-[13px] text-income">✓ Saved</span>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          className="rounded-sm bg-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-bg transition-colors duration-150 hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
