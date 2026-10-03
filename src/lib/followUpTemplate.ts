export interface FollowUpTemplateValues {
  client_name: string
  invoice_number: string
  amount: string
  due_date: string
  days_overdue: string
  business_name: string
}

/** Format a YYYY-MM-DD date as a human-readable local date (e.g. "29 June 2026"). */
export function formatFollowUpDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Format integer pence as £X,XXX.XX. */
export function formatFollowUpAmount(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Substitute known placeholders in a follow-up template.
 * Unknown placeholders are left untouched.
 */
export function applyFollowUpTemplate(
  template: string,
  values: FollowUpTemplateValues,
): string {
  return template
    .replaceAll('{client_name}', values.client_name)
    .replaceAll('{invoice_number}', values.invoice_number)
    .replaceAll('{amount}', values.amount)
    .replaceAll('{due_date}', values.due_date)
    .replaceAll('{days_overdue}', values.days_overdue)
    .replaceAll('{business_name}', values.business_name)
}
