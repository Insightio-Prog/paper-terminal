import { stripMarkdown } from '../lib/stripMarkdown'

interface ClaudeResponseCardProps {
  message: string
  onDismiss: () => void
}

export function ClaudeResponseCard({
  message,
  onDismiss,
}: ClaudeResponseCardProps) {
  const displayMessage = stripMarkdown(message)

  return (
    <div className="shrink-0 border-t border-l-2 border-border border-l-accent bg-bg-raised px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-[13px] text-ink">
          <span className="text-accent">❯</span> {displayMessage}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss response"
          className="shrink-0 font-mono text-[16px] leading-none text-ink-faint transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </div>
    </div>
  )
}
