export interface TaxDeadline {
  label: string
  date: string
  daysRemaining: number
  urgent: boolean
  passed: boolean
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay,
  )
}

/** First calendar year of the UK tax year containing `today` (6 Apr – 5 Apr). */
function taxYearStartYear(today: Date): number {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const isOnOrAfterTaxYearStart = month > 4 || (month === 4 && day >= 6)
  return isOnOrAfterTaxYearStart ? year : year - 1
}

interface RawDeadline {
  label: string
  date: Date
}

/**
 * Deadlines that fall during / just after the tax year that started on
 * 6 Apr `startYear`. Offsets are relative to that start year so that, e.g.
 * for startYear 2026 (TY 2026–27), we surface:
 * - Second payment on account: 31 Jul 2026 (prior TY)
 * - Register for Self Assessment: 5 Oct 2026 (prior TY)
 * - Self Assessment filing & payment: 31 Jan 2027 (prior TY)
 * - Tax year end / new tax year: 5–6 Apr 2027 (current TY)
 */
function deadlinesForTaxYear(startYear: number): RawDeadline[] {
  return [
    {
      label: 'Second payment on account',
      date: new Date(startYear, 6, 31),
    },
    {
      label: 'Register for Self Assessment',
      date: new Date(startYear, 9, 5),
    },
    {
      label: 'Self Assessment filing & payment',
      date: new Date(startYear + 1, 0, 31),
    },
    { label: 'Tax year end', date: new Date(startYear + 1, 3, 5) },
    { label: 'New tax year begins', date: new Date(startYear + 1, 3, 6) },
  ]
}

function toTaxDeadline(today: Date, raw: RawDeadline): TaxDeadline {
  const daysRemaining = daysBetween(today, raw.date)

  return {
    label: raw.label,
    date: toIsoDate(raw.date),
    daysRemaining,
    urgent: daysRemaining >= 0 && daysRemaining <= 30,
    passed: daysRemaining < 0,
  }
}

export function getUpcomingDeadlines(today: Date): TaxDeadline[] {
  const todayStart = startOfDay(today)
  const startYear = taxYearStartYear(todayStart)

  const rawDeadlines = [
    ...deadlinesForTaxYear(startYear),
    ...deadlinesForTaxYear(startYear + 1),
  ]

  const seen = new Set<string>()
  const deadlines: TaxDeadline[] = []

  for (const raw of rawDeadlines) {
    const key = `${raw.label}:${toIsoDate(raw.date)}`
    if (seen.has(key)) continue
    seen.add(key)

    const deadline = toTaxDeadline(todayStart, raw)
    if (deadline.daysRemaining < -30) continue

    deadlines.push(deadline)
  }

  return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

export function formatDeadlineDisplayDate(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.split('-')
  const date = new Date(
    Number.parseInt(yearStr, 10),
    Number.parseInt(monthStr, 10) - 1,
    Number.parseInt(dayStr, 10),
  )

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDeadlinesForBriefing(today: Date): string {
  const deadlines = getUpcomingDeadlines(today)

  if (deadlines.length === 0) {
    return 'UPCOMING TAX DEADLINES:\n\nNone in the next 12 months.'
  }

  const lines = deadlines.map((deadline) => {
    const dateLabel = formatDeadlineDisplayDate(deadline.date)
    const proximity = deadline.passed
      ? `${Math.abs(deadline.daysRemaining)} days ago`
      : `${deadline.daysRemaining} days`
    const urgent = deadline.urgent ? ' URGENT' : ''

    return `${deadline.label}: ${dateLabel} (${proximity})${urgent}`
  })

  return ['UPCOMING TAX DEADLINES:', '', ...lines].join('\n')
}
