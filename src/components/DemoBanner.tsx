import { useState } from 'react'
import { X } from 'lucide-react'
import { resetDemoData } from '../lib/demo/seed'

export const REPO_URL = 'https://github.com/Insightio-Prog/paper-terminal'

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="About this demo"
    >
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto border border-border bg-bg p-6 rounded-[2px]">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="font-mono text-sm font-medium tracking-tight text-ink">
            About this demo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-secondary hover:text-ink"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 font-mono text-[12px] leading-relaxed text-ink-secondary">
          <p>
            <span className="text-ink">Paper Terminal</span> is a small
            business suite for UK sole traders: a ledger with a Self Assessment
            tax estimate, invoices with PDF export, a client list, documents,
            receipt capture, and a Claude command bar. I built it with Claude
            and Cursor, as a chef learning to ship real software.
          </p>

          <div>
            <p className="mb-1 text-ink">Things to try</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Type into the command bar: "add a £24 software expense for
                today" or "who owes me money?"
              </li>
              <li>Open an invoice and download the PDF.</li>
              <li>Photograph a receipt in Receipt Capture and let Claude read it.</li>
              <li>Settings, Billing: preview the (mock) checkout.</li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-ink">What is different in this demo</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                All data is fictional and lives only in your browser. Use
                "Reset demo" to start over.
              </li>
              <li>
                Sign-in is removed. The real app used Supabase accounts with
                row-level security.
              </li>
              <li>
                Stripe is a mock. The real app created Checkout sessions and
                verified webhooks in a Cloudflare Worker.
              </li>
              <li>
                Claude calls go through a locked-down Worker with strict
                per-visitor and daily limits, so the AI may occasionally say
                the demo budget is used up.
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-ink">Under the hood</p>
            <p>
              React 19, TypeScript, Vite, Tailwind 4 and Zustand. Money is
              stored as integer pence. The tax maths has unit tests. Data
              access sits behind repository interfaces, which is how this demo
              swaps the database for browser storage without touching the
              screens.
            </p>
          </div>

          <p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-ink underline underline-offset-2"
            >
              View the source on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export function DemoBanner() {
  const [aboutOpen, setAboutOpen] = useState(false)

  function handleReset() {
    if (
      !window.confirm(
        'Reset the demo? Your changes will be removed and the sample data restored.',
      )
    ) {
      return
    }
    resetDemoData()
    window.location.reload()
  }

  const link =
    'text-ink underline underline-offset-2 hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-bg-inset px-4 py-1.5 font-mono text-[11px] text-ink-secondary">
        <span>
          <span className="text-ink">Demo</span> · fictional data, stored only
          in your browser
        </span>
        <span className="ml-auto flex items-center gap-4">
          <button type="button" onClick={() => setAboutOpen(true)} className={link}>
            About
          </button>
          <button type="button" onClick={handleReset} className={link}>
            Reset demo
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={link}>
            GitHub
          </a>
        </span>
      </div>
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </>
  )
}
