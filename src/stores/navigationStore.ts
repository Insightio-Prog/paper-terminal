import { create } from 'zustand'

export type ActiveView =
  | 'dashboard'
  | 'ledger'
  | 'invoicing'
  | 'crm'
  | 'documents'
  | 'email'
  | 'receiptCapture'
  | 'settings'

interface NavigationState {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
}))
