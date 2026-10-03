import { create } from 'zustand'

export type ToastVariant = 'default' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: {
    message: string
    variant?: ToastVariant
    action?: ToastAction
    durationMs?: number
  }) => string
  dismissToast: (id: string) => void
}

const DEFAULT_DURATION_MS = 6000
const MAX_VISIBLE_TOASTS = 4
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

export const useToastStore = create<ToastState>((set, get) => {
  function scheduleDismiss(id: string, ms: number) {
    clearTimer(id)
    if (ms <= 0) return
    const timer = setTimeout(() => {
      get().dismissToast(id)
    }, ms)
    timers.set(id, timer)
  }

  return {
    toasts: [],

    addToast: ({ message, variant = 'default', action, durationMs }) => {
      const ms = durationMs ?? DEFAULT_DURATION_MS
      const existing = get().toasts.find(
        (toast) => toast.message === message && toast.variant === variant,
      )

      if (existing) {
        scheduleDismiss(existing.id, ms)
        return existing.id
      }

      const id = crypto.randomUUID()
      const toast: Toast = { id, message, variant, action }

      set((state) => {
        let next = [...state.toasts, toast]
        while (next.length > MAX_VISIBLE_TOASTS) {
          const [oldest, ...rest] = next
          clearTimer(oldest.id)
          next = rest
        }
        return { toasts: next }
      })

      scheduleDismiss(id, ms)
      return id
    },

    dismissToast: (id) => {
      clearTimer(id)
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }))
    },
  }
})

/** Log the underlying error and show a friendly error toast. */
export function reportStoreError(friendlyMessage: string, error: unknown): void {
  console.error(friendlyMessage, error)
  useToastStore.getState().addToast({
    message: friendlyMessage,
    variant: 'error',
  })
}
