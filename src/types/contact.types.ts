export interface Contact {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ContactInput = Omit<Contact, 'id' | 'created_at' | 'updated_at'>
