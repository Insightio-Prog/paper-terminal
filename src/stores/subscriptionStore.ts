import { create } from 'zustand'
import { readJson, writeJson } from '../lib/demo/storage'

/**
 * Demo billing. The original app created real Stripe Checkout sessions and
 * handled webhooks in a Cloudflare Worker. In this public demo nothing is
 * charged and no card details are collected: the checkout screen is a mock,
 * and the "subscription" is just a flag in the visitor's browser.
 */
export type Plan = 'monthly' | 'annual'

export interface DemoSubscription {
  plan: Plan
  status: 'trialing' | 'canceled'
  trial_ends: string
}

interface SubscriptionState {
  subscription: DemoSubscription | null
  load: () => void
  startTrial: (plan: Plan) => void
  cancel: () => void
}

const KEY = 'subscription'

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: readJson<DemoSubscription | null>(KEY, null),

  load: () => set({ subscription: readJson<DemoSubscription | null>(KEY, null) }),

  startTrial: (plan) => {
    const next: DemoSubscription = {
      plan,
      status: 'trialing',
      trial_ends: new Date(Date.now() + 48 * 3_600_000).toISOString(),
    }
    writeJson(KEY, next)
    set({ subscription: next })
  },

  cancel: () => {
    const current = get().subscription
    if (!current) return
    const next: DemoSubscription = { ...current, status: 'canceled' }
    writeJson(KEY, next)
    set({ subscription: next })
  },
}))
