import { create } from 'zustand'
import { repositories } from '../lib/repository'
import type { Contact, ContactInput } from '../types/contact.types'
import { reportStoreError } from './toastStore'

export type { Contact, ContactInput }

interface ContactState {
  contacts: Contact[]
  loading: boolean
  loadContacts: () => Promise<void>
  addContact: (contact: ContactInput) => Promise<string>
  updateContact: (id: string, fields: Partial<ContactInput>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  loading: false,

  loadContacts: async () => {
    set({ loading: true })

    try {
      const contacts = await repositories.contacts.list()
      set({ contacts, loading: false })
    } catch (error) {
      set({ loading: false })
      reportStoreError("Couldn't load contacts", error)
    }
  },

  addContact: async (contact) => {
    const now = new Date().toISOString()
    try {
      const id = await repositories.contacts.add(contact, now)
      await get().loadContacts()
      return id
    } catch (error) {
      reportStoreError("Couldn't save contact", error)
      throw error
    }
  },

  updateContact: async (id, fields) => {
    const current = get().contacts.find((contact) => contact.id === id)
    if (!current) return

    const next: Contact = {
      ...current,
      ...fields,
      updated_at: new Date().toISOString(),
    }

    try {
      await repositories.contacts.update(id, next)
      await get().loadContacts()
    } catch (error) {
      reportStoreError("Couldn't update contact", error)
      throw error
    }
  },

  deleteContact: async (id) => {
    try {
      await repositories.contacts.delete(id)
      await get().loadContacts()
    } catch (error) {
      reportStoreError("Couldn't delete contact", error)
      throw error
    }
  },
}))
