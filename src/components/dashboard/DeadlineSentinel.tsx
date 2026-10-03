import { useMemo, useState } from 'react'
import {
  formatDeadlineDisplayDate,
  getUpcomingDeadlines,
} from '../../lib/deadlines'

export function DeadlineSentinel() {
  const [expanded, setExpanded] = useState(false)

  const upcoming = useMemo(() => {
    return getUpcomingDeadlines(new Date()).filter(
      (deadline) => !deadline.passed,
    )
  }, [])

  return (
    <div className="shrink-0 border-b border-border bg-bg-raised px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full cursor-pointer items-center text-left"
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
          <span className="text-ink-secondary">Deadline Sentinel</span>
          <span className="ml-2 normal-case tracking-normal text-ink-faint">
            UK tax deadlines
          </span>
        </div>
      </button>

      {expanded && (
        <>
          <div className="my-3 border-b border-border" />

          {upcoming.length === 0 ? (
            <p className="font-mono text-[13px] text-ink-faint">
              No upcoming deadlines
            </p>
          ) : (
            <ul className="space-y-0 font-mono text-[13px]">
              {upcoming.map((deadline) => {
                const daysLabel =
                  deadline.daysRemaining === 1
                    ? '1 day'
                    : `${deadline.daysRemaining} days`

                return (
                  <li
                    key={`${deadline.label}-${deadline.date}`}
                    className="flex items-center gap-4 border-b border-border py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 text-ink">
                      {deadline.label}
                    </span>
                    <time
                      dateTime={deadline.date}
                      className="shrink-0 text-ink-faint"
                    >
                      {formatDeadlineDisplayDate(deadline.date)}
                    </time>
                    <span
                      className={[
                        'shrink-0 rounded-sm px-2 py-0.5 font-mono text-[11px] tabular-nums',
                        deadline.urgent
                          ? 'bg-accent text-bg'
                          : 'bg-bg-inset text-ink-faint',
                      ].join(' ')}
                    >
                      {daysLabel}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
