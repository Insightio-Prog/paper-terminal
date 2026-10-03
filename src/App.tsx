import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  FolderOpen,
  Mail,
  Camera,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { generateMorningBriefing } from './ai/morningBriefing'
import { DemoBanner } from './components/DemoBanner'
import { CommandBar } from './components/CommandBar'
import { ToastHost } from './components/ToastHost'
import { ContactList } from './components/crm/ContactList'
import { Dashboard } from './components/Dashboard'
import { DocumentList } from './components/documents/DocumentList'
import { InvoiceList } from './components/invoicing/InvoiceList'
import { LedgerPage } from './components/ledger/LedgerPage'
import { ReceiptCapture } from './components/receipts/ReceiptCapture'
import { Settings } from './components/Settings'
import { useCommandStore } from './stores/commandStore'
import { useContactStore } from './stores/contactStore'
import { useDocumentStore } from './stores/documentStore'
import { useInvoiceStore } from './stores/invoiceStore'
import { useLedgerStore } from './stores/ledgerStore'
import {
  useNavigationStore,
  type ActiveView,
} from './stores/navigationStore'
import { useProfileStore } from './stores/profileStore'
import { useIsMobile } from './hooks/useIsMobile'
import paperTerminalLogo from './assets/Logos/paper-terminal-icon-96.png'

const MOBILE_VIEWS = ['dashboard', 'settings', 'receiptCapture'] as const

const navItems: { id: ActiveView; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'invoicing', label: 'Invoicing', icon: FileText },
  { id: 'crm', label: 'CRM', icon: Users },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'receiptCapture', label: 'Receipt Capture', icon: Camera },
]

function todayIsoLocal(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Shared across remounts so StrictMode cannot fire two Claude calls. */
let morningBriefingInFlight: Promise<void> | null = null

interface BriefingProps {
  briefing: string | null
  briefingLoading: boolean
  briefingDate: string
  briefingIsError: boolean
  briefingRegenError: string | null
  onDismissBriefing: () => void
  onRegenerateBriefing: () => void
  showRegeneratePrompt: boolean
}

function Canvas({
  briefingProps,
  isMobile,
}: {
  briefingProps: BriefingProps
  isMobile: boolean
}) {
  const activeView = useNavigationStore((s) => s.activeView)

  switch (activeView) {
    case 'ledger':
      if (isMobile) return null
      return <LedgerPage />
    case 'settings':
      return <Settings />
    case 'invoicing':
      if (isMobile) return null
      return <InvoiceList />
    case 'crm':
      if (isMobile) return null
      return <ContactList />
    case 'documents':
      if (isMobile) return null
      return <DocumentList key="all" />
    case 'email':
      if (isMobile) return null
      return <DocumentList key="Email" fixedCategory="Email" />
    case 'receiptCapture':
      return <ReceiptCapture />
    case 'dashboard':
      return <Dashboard {...briefingProps} />
    default:
      return <Dashboard {...briefingProps} />
  }
}

function Shell() {
  const activeView = useNavigationStore((s) => s.activeView)
  const setActiveView = useNavigationStore((s) => s.setActiveView)
  const clearConversation = useCommandStore((s) => s.clearConversation)
  const taxYear = useLedgerStore((s) => s.taxYear)
  const loadEntries = useLedgerStore((s) => s.loadEntries)
  const loadProfile = useProfileStore((s) => s.loadProfile)
  const loadContacts = useContactStore((s) => s.loadContacts)
  const loadDocuments = useDocumentStore((s) => s.loadDocuments)
  const loadInvoices = useInvoiceStore((s) => s.loadInvoices)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (
      isMobile &&
      !(MOBILE_VIEWS as readonly string[]).includes(activeView)
    ) {
      setActiveView('dashboard')
    }
  }, [isMobile, activeView, setActiveView])

  const visibleNavItems = isMobile
    ? navItems.filter((item) =>
        (MOBILE_VIEWS as readonly string[]).includes(item.id),
      )
    : navItems

  const [briefing, setBriefing] = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingEligible, setBriefingEligible] = useState(false)
  const [briefingDismissed, setBriefingDismissed] = useState(false)
  const [briefingIsError, setBriefingIsError] = useState(false)
  const [briefingRegenError, setBriefingRegenError] = useState<string | null>(
    null,
  )
  const [briefingDate] = useState(() => todayIsoLocal())
  const saveProfile = useProfileStore((s) => s.saveProfile)

  const persistBriefingCache = useCallback(
    async (text: string, date: string) => {
      try {
        await saveProfile({
          briefing_cache: text,
          briefing_date: date,
        })
      } catch (error) {
        console.error("Couldn't cache morning briefing", error)
      }
    },
    [saveProfile],
  )

  const runBriefingGeneration = useCallback(
    async (options?: { force?: boolean; keepPreviousOnError?: boolean }) => {
      const force = options?.force ?? false
      const keepPreviousOnError = options?.keepPreviousOnError ?? false

      if (morningBriefingInFlight) {
        await morningBriefingInFlight
        return
      }

      morningBriefingInFlight = (async () => {
        await loadEntries(taxYear)
        await loadInvoices()

        if (!force) {
          const profile = useProfileStore.getState()
          if (
            profile.briefing_date === briefingDate &&
            profile.briefing_cache.trim()
          ) {
            setBriefing(profile.briefing_cache)
            setBriefingIsError(false)
            setBriefingRegenError(null)
            setBriefingDismissed(false)
            setBriefingEligible(true)
            return
          }
        }

        setBriefingLoading(true)
        setBriefingIsError(false)
        setBriefingRegenError(null)
        try {
          const text = await generateMorningBriefing(briefingDate)
          setBriefing(text)
          setBriefingDismissed(false)
          setBriefingIsError(false)
          setBriefingRegenError(null)
          await persistBriefingCache(text, briefingDate)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Claude couldn't respond just now. Try again in a moment."
          if (keepPreviousOnError) {
            setBriefingRegenError(message)
          } else {
            setBriefing(message)
            setBriefingIsError(true)
            setBriefingDismissed(false)
          }
        } finally {
          setBriefingEligible(true)
          setBriefingLoading(false)
        }
      })()

      try {
        await morningBriefingInFlight
      } finally {
        morningBriefingInFlight = null
      }
    },
    [
      loadEntries,
      loadInvoices,
      taxYear,
      briefingDate,
      persistBriefingCache,
    ],
  )

  const regenerateBriefing = useCallback(() => {
    void runBriefingGeneration({ force: true, keepPreviousOnError: true })
  }, [runBriefingGeneration])

  useEffect(() => {
    async function bootstrap() {
      await Promise.all([
        loadProfile(),
        loadEntries(taxYear),
        loadContacts(),
        loadDocuments(),
        loadInvoices(),
      ])

      // Mount-time cache check + generation (shared in-flight guard).
      await runBriefingGeneration({ force: false })
    }

    void bootstrap()
  }, [
    loadProfile,
    loadEntries,
    loadContacts,
    loadDocuments,
    loadInvoices,
    taxYear,
    runBriefingGeneration,
  ])

  const briefingProps: BriefingProps = {
    briefing,
    briefingLoading,
    briefingDate,
    briefingIsError,
    briefingRegenError,
    onDismissBriefing: () => {
      setBriefing(null)
      setBriefingIsError(false)
      setBriefingRegenError(null)
      setBriefingDismissed(true)
    },
    onRegenerateBriefing: regenerateBriefing,
    showRegeneratePrompt:
      briefingEligible &&
      briefingDismissed &&
      !briefing &&
      !briefingLoading,
  }

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
      <nav className="flex w-[80px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-bg-raised py-3">
        {!isMobile && (
          <div className="mb-2 flex shrink-0 items-center justify-center px-2 pt-0.5 pb-1">
            <img
              src={paperTerminalLogo}
              alt="Paper Terminal"
              width={32}
              height={32}
              className="size-8"
            />
          </div>
        )}
        {visibleNavItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (id !== activeView) clearConversation()
                setActiveView(id)
              }}
              className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-[2px] transition-colors ${
                isActive
                  ? 'bg-bg-inset text-ink'
                  : 'text-ink-secondary hover:bg-bg-inset hover:text-ink'
              }`}
            >
              <Icon size={24} strokeWidth={1.5} />
              <span className="text-[10px] leading-none tracking-tight">
                {label}
              </span>
            </button>
          )
        })}

        <div className="mt-auto flex flex-col items-center gap-1.5">
          <button
            type="button"
            title="Settings"
            aria-label="Settings"
            aria-current={activeView === 'settings' ? 'page' : undefined}
            onClick={() => {
              if (activeView !== 'settings') clearConversation()
              setActiveView('settings')
            }}
            className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-[2px] transition-colors ${
              activeView === 'settings'
                ? 'bg-bg-inset text-ink'
                : 'text-ink-secondary hover:bg-bg-inset hover:text-ink'
            }`}
          >
            <SettingsIcon size={24} strokeWidth={1.5} />
            <span className="text-[10px] leading-none tracking-tight">
              Settings
            </span>
          </button>
        </div>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-bg">
          <Canvas briefingProps={briefingProps} isMobile={isMobile} />
        </main>
        <CommandBar inputRef={commandInputRef} />
        <ToastHost />
      </div>
      </div>
    </div>
  )
}

export default function App() {
  return <Shell />
}
