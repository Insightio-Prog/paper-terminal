import { MorningBriefing } from './MorningBriefing'
import { DeadlineSentinel } from './dashboard/DeadlineSentinel'
import { OverdueFollowUps } from './dashboard/OverdueFollowUps'

export interface DashboardProps {
  briefing: string | null
  briefingLoading: boolean
  briefingDate: string
  briefingIsError?: boolean
  briefingRegenError?: string | null
  onDismissBriefing: () => void
  onRegenerateBriefing: () => void
  showRegeneratePrompt: boolean
}

export function Dashboard({
  briefing,
  briefingLoading,
  briefingDate,
  briefingIsError = false,
  briefingRegenError = null,
  onDismissBriefing,
  onRegenerateBriefing,
  showRegeneratePrompt,
}: DashboardProps) {
  const showInitialLoading = briefingLoading && !briefing

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          Dashboard
        </h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showInitialLoading && (
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="font-mono text-[13px] text-ink-faint">
              <span className="text-accent">❯</span> Reading your books...
            </p>
          </div>
        )}

        {briefingLoading && briefing && (
          <div className="shrink-0 border-b border-border px-4 py-3">
            <p className="font-mono text-[13px] text-ink-faint">
              <span className="text-accent">❯</span> Reading your books...
            </p>
          </div>
        )}

        {briefing && (
          <MorningBriefing
            briefing={briefing}
            todayDate={briefingDate}
            onDismiss={onDismissBriefing}
            onRegenerate={onRegenerateBriefing}
            regenerating={briefingLoading}
            regenError={briefingRegenError}
            muted={briefingIsError}
          />
        )}

        {!briefing && !briefingLoading && showRegeneratePrompt && (
          <div className="shrink-0 border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={onRegenerateBriefing}
              className="font-mono text-[12px] text-accent transition-colors duration-150 hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              ❯ Generate new briefing
            </button>
          </div>
        )}

        {briefing && briefingIsError && !briefingLoading && (
          <div className="shrink-0 border-b border-border px-4 py-3">
            <button
              type="button"
              onClick={onRegenerateBriefing}
              className="font-mono text-[12px] text-accent transition-colors duration-150 hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              ❯ Generate new briefing
            </button>
          </div>
        )}

        <OverdueFollowUps />

        <DeadlineSentinel />
      </div>
    </div>
  )
}
