import { create } from 'zustand'
import { repositories } from '../lib/repository'
import type { Document, DocumentInput } from '../types/document.types'
import { reportStoreError } from './toastStore'

interface DocumentState {
  documents: Document[]
  loading: boolean
  loadDocuments: () => Promise<void>
  addDocument: (fields: DocumentInput) => Promise<string>
  updateDocument: (id: string, fields: Partial<DocumentInput>) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  loading: false,

  loadDocuments: async () => {
    set({ loading: true })

    try {
      const documents = await repositories.documents.list()
      set({ documents, loading: false })
    } catch (error) {
      set({ loading: false })
      reportStoreError("Couldn't load documents", error)
    }
  },

  addDocument: async (fields) => {
    const now = new Date().toISOString()
    try {
      const id = await repositories.documents.add(fields, now)
      await get().loadDocuments()
      return id
    } catch (error) {
      reportStoreError("Couldn't save document", error)
      throw error
    }
  },

  updateDocument: async (id, fields) => {
    const current = get().documents.find((document) => document.id === id)
    if (!current) return

    const next: Document = {
      ...current,
      ...fields,
      updated_at: new Date().toISOString(),
    }

    try {
      await repositories.documents.update(id, next)
      await get().loadDocuments()
    } catch (error) {
      reportStoreError("Couldn't save document", error)
      throw error
    }
  },

  deleteDocument: async (id) => {
    try {
      await repositories.documents.delete(id)
      await get().loadDocuments()
    } catch (error) {
      reportStoreError("Couldn't delete document", error)
      throw error
    }
  },
}))
