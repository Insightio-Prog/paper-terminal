import { useState } from 'react'

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

interface MorningBriefingProps {
  briefing: string
  todayDate: string
  onDismiss: () => void
  onRegenerate: () => void
  regenerating?: boolean
  regenError?: string | null
  muted?: boolean
}

export function MorningBriefing({
  briefing,
  todayDate,
  onDismiss,
  onRegenerate,
  regenerating = false,
  regenError = null,
  muted = false,
}: MorningBriefingProps) {
  const [expanded, setExpanded] = useState(true)

  const paragraphs = briefing
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="shrink-0 border-b border-border bg-bg-raised px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.08em]">
          <span
            className={[
              'inline-block text-ink-faint transition-transform duration-200 ease-out',
              expanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
            aria-hidden="true"
          >
            ❯
          </span>{' '}
          <span className="text-ink-secondary">Morning Briefing</span>
        </div>
        <time
          dateTime={todayDate}
          className="font-mono text-[11px] text-ink-faint"
        >
          {formatDisplayDate(todayDate)}
        </time>
      </button>

      {expanded && (
        <>
          <div className="my-3 border-b border-border" />

          <div
            className={[
              'space-y-3 font-mono text-[13px] leading-relaxed',
              muted ? 'text-ink-faint' : 'text-ink',
            ].join(' ')}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {regenError && (
            <p className="mt-3 font-mono text-[13px] text-expense">{regenError}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={regenerating}
              onClick={onRegenerate}
              className="font-mono text-[12px] text-accent transition-colors duration-150 hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {regenerating ? '❯ Working...' : '❯ Regenerate'}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={regenerating}
              className="font-mono text-[13px] text-ink-faint transition-colors duration-150 hover:text-ink-secondary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Dismiss ×
            </button>
          </div>
        </>
      )}
    </div>
  )
}
