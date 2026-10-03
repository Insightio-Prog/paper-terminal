export interface Document {
  id: string
  title: string
  content: string
  category: string
  created_at: string
  updated_at: string
}

export type DocumentInput = Omit<Document, 'id' | 'created_at' | 'updated_at'>
