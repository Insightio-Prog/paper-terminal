import { create } from 'zustand'
import { repositories } from '../lib/repository'
import type { BusinessProfile } from '../types/profile.types'
import { reportStoreError } from './toastStore'

export type { BusinessProfile }

export type BusinessProfileUpdate = Partial<
  Omit<BusinessProfile, 'updated_at'>
>

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  business_name: '',
  owner_name: '',
  address: '',
  email: '',
  phone: '',
  website: '',
  vat_number: '',
  accent_colour: '#C25A3A',
  default_payment_terms: 'Payment due within 30 days',
  default_notes: '',
  logo_path: '',
  paye_tax_paid: 0,
  follow_up_template: '',
  auto_log_subscription: true,
  briefing_cache: '',
  briefing_date: '',
  updated_at: '',
}

interface ProfileState extends BusinessProfile {
  loadProfile: () => Promise<void>
  saveProfile: (updates: BusinessProfileUpdate) => Promise<void>
  setLogoPath: (path: string) => Promise<void>
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  ...DEFAULT_BUSINESS_PROFILE,

  loadProfile: async () => {
    try {
      const profile = await repositories.profile.get()

      if (profile === null) {
        set(DEFAULT_BUSINESS_PROFILE)
        return
      }

      set(profile)
    } catch (error) {
      reportStoreError("Couldn't load profile", error)
    }
  },

  saveProfile: async (updates) => {
    const current = get()
    const next: BusinessProfile = {
      business_name: updates.business_name ?? current.business_name,
      owner_name: updates.owner_name ?? current.owner_name,
      address: updates.address ?? current.address,
      email: updates.email ?? current.email,
      phone: updates.phone ?? current.phone,
      website: updates.website ?? current.website,
      vat_number: updates.vat_number ?? current.vat_number,
      accent_colour: updates.accent_colour ?? current.accent_colour,
      default_payment_terms:
        updates.default_payment_terms ?? current.default_payment_terms,
      default_notes: updates.default_notes ?? current.default_notes,
      logo_path: updates.logo_path ?? current.logo_path,
      paye_tax_paid: updates.paye_tax_paid ?? current.paye_tax_paid,
      follow_up_template:
        updates.follow_up_template ?? current.follow_up_template,
      auto_log_subscription:
        updates.auto_log_subscription ?? current.auto_log_subscription,
      briefing_cache: updates.briefing_cache ?? current.briefing_cache,
      briefing_date: updates.briefing_date ?? current.briefing_date,
      updated_at: new Date().toISOString(),
    }

    try {
      await repositories.profile.save(next)
      await get().loadProfile()
    } catch (error) {
      reportStoreError("Couldn't save profile", error)
      throw error
    }
  },

  setLogoPath: async (path) => {
    await get().saveProfile({ logo_path: path })
  },
}))
