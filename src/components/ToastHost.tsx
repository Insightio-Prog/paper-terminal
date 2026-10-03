import { useToastStore } from '../stores/toastStore'

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismissToast = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(var(--command-bar-height)+12px)] left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-3"
      style={{ bottom: 'calc(var(--command-bar-height) + 12px)' }}
    >
      {toasts.map((toast) => {
        const isError = toast.variant === 'error'
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={[
              'pointer-events-auto flex items-start gap-3 border px-3 py-2 font-mono text-[13px]',
              isError
                ? 'border-accent bg-bg-raised text-accent'
                : 'border-border bg-bg-raised text-ink',
            ].join(' ')}
          >
            <p className="min-w-0 flex-1">
              {!isError && <span className="text-income">✓</span>}{' '}
              {toast.message}
              {toast.action && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick()
                      dismissToast(toast.id)
                    }}
                    className="text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {toast.action.label}
                  </button>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className={[
                'shrink-0 leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                isError
                  ? 'text-accent hover:text-accent-ink'
                  : 'text-ink-faint hover:text-ink',
              ].join(' ')}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
