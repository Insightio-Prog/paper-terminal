import { useState } from 'react'
import { X } from 'lucide-react'
import { useSubscriptionStore, type Plan } from '../../stores/subscriptionStore'
import { useToastStore } from '../../stores/toastStore'

const planCardClass =
  'flex flex-1 flex-col border bg-bg-raised p-4 rounded-[2px] text-left transition-colors hover:bg-bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink'

/**
 * Mock of the Stripe Checkout step. No payment details are collected or sent
 * anywhere: the card number is a fixed, well-known Stripe TEST number shown
 * for illustration only.
 */
export function MockCheckout({ onClose }: { onClose: () => void }) {
  const startTrial = useSubscriptionStore((s) => s.startTrial)
  const addToast = useToastStore((s) => s.addToast)
  const [plan, setPlan] = useState<Plan>('monthly')

  function handleStart() {
    startTrial(plan)
    addToast({
      message: 'Demo only: free trial started. Nothing was charged.',
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout (demo)"
    >
      <div className="w-full max-w-lg border border-border bg-bg p-6 rounded-[2px]">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="font-mono text-sm font-medium tracking-tight text-ink">
            Paper Terminal
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
        <p className="mb-4 font-mono text-[12px] text-ink-secondary">
          UK sole trader books, invoices, and a Claude command bar.
        </p>

        <p className="mb-4 border border-border bg-bg-raised px-3 py-2 font-mono text-[11px] text-ink-secondary">
          TEST MODE MOCK. This is a recreation of the Stripe checkout step for
          the demo. No card details are collected and nothing is charged.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setPlan('monthly')}
            aria-pressed={plan === 'monthly'}
            className={`${planCardClass} ${plan === 'monthly' ? 'border-ink' : 'border-border'}`}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
              Monthly
            </span>
            <span className="mt-2 font-mono text-[20px] tabular-nums text-ink">
              £7.99
              <span className="text-[13px] text-ink-faint">/month</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPlan('annual')}
            aria-pressed={plan === 'annual'}
            className={`${planCardClass} ${plan === 'annual' ? 'border-ink' : 'border-border'}`}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
              Annual
            </span>
            <span className="mt-2 font-mono text-[20px] tabular-nums text-ink">
              £79.99
              <span className="text-[13px] text-ink-faint">/year</span>
            </span>
            <span className="mt-2 font-mono text-[11px] text-ink-faint">
              ≈ 2 months free
            </span>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="border border-border bg-bg-inset px-3 py-2 font-mono text-[13px] text-ink-secondary">
            4242 4242 4242 4242
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-border bg-bg-inset px-3 py-2 font-mono text-[13px] text-ink-secondary">
              12 / 34
            </div>
            <div className="border border-border bg-bg-inset px-3 py-2 font-mono text-[13px] text-ink-secondary">
              123
            </div>
          </div>
          <p className="font-mono text-[11px] text-ink-faint">
            Stripe's published test card, shown for illustration only.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="mt-5 w-full rounded-sm bg-ink px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bg transition-colors hover:bg-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Start 48-hour free trial
        </button>
        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          In the real app this step redirects to Stripe Checkout, and a
          webhook (verified server-side) records the subscription.
        </p>
      </div>
    </div>
  )
}
