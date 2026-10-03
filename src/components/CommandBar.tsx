import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { runCommand } from '../ai/toolLoop'
import { useCommandStore } from '../stores/commandStore'
import { useNavigationStore } from '../stores/navigationStore'
import { ClaudeResponseCard } from './ClaudeResponseCard'

interface CommandBarProps {
  inputRef: RefObject<HTMLInputElement | null>
}

export function CommandBar({ inputRef }: CommandBarProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const clearConversation = useCommandStore((s) => s.clearConversation)
  const activeView = useNavigationStore((s) => s.activeView)

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inputRef])

  // Clear card UI when the user changes module. History is cleared from nav
  // click handlers so tool-driven setActiveView (e.g. create_invoice) does not
  // wipe mid-command memory — this effect only drops the visible card.
  useEffect(() => {
    setResponse(null)
  }, [activeView])

  async function handleSubmit() {
    const input = inputRef.current
    if (!input || isWorking) return

    const message = input.value.trim()
    if (!message) return

    input.value = ''
    setResponse(null)
    setIsWorking(true)

    try {
      const result = await runCommand(message)
      setResponse(result)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Claude couldn't respond just now. Try again in a moment."
      setResponse(text)
    } finally {
      setIsWorking(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSubmit()
    }
  }

  function handleDismiss() {
    clearConversation()
    setResponse(null)
  }

  return (
    <>
      {response && (
        <ClaudeResponseCard message={response} onDismiss={handleDismiss} />
      )}

      <div
        className="flex w-full min-w-0 shrink-0 items-center border-t border-border bg-bg-inset focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-accent"
        style={{ height: 'var(--command-bar-height)' }}
      >
        <label htmlFor="command-bar-input" className="sr-only">
          Command bar
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-4 font-mono text-[15px]">
          <span
            className="shrink-0 text-[18px] leading-none text-accent"
            aria-hidden="true"
          >
            ❯
          </span>

          {isWorking ? (
            <span className="text-accent" aria-live="polite" aria-busy="true">
              Working...
            </span>
          ) : (
            <input
              ref={inputRef}
              id="command-bar-input"
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="ask claude or type a command..."
              onKeyDown={handleKeyDown}
              disabled={isWorking}
              className="min-w-0 flex-1 border-none bg-transparent font-mono text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:outline-none focus-visible:!outline-none disabled:cursor-not-allowed"
            />
          )}
        </div>
      </div>
    </>
  )
}
