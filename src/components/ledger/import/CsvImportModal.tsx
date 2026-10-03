import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import { formatPence } from '../../../lib/money'
import {
  annotateDuplicates,
  autoDetectMapping,
  entryKindToLedgerType,
  formatTaxYearSpanSummary,
  mapAllCsvRows,
  resolveImportCategory,
  tableFromRawRows,
  uniqueTaxYears,
  type AmountMode,
  type ColumnMapping,
  type CsvDateFormat,
  type MappedImportRow,
  type ParsedCsvTable,
} from '../../../lib/csvImport'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  useLedgerStore,
} from '../../../stores/ledgerStore'
import { useToastStore } from '../../../stores/toastStore'
import type { LedgerEntry } from '../../../types/ledger.types'

/** Same as ledger selects, but ink focus — not terracotta (Claude/urgent only). */
const importSelectClass =
  'rounded-sm border border-border bg-bg-inset px-2 py-1 font-mono text-[13px] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink'

type Step = 'file' | 'mapping' | 'preview'

const DATE_FORMATS: CsvDateFormat[] = [
  'DD/MM/YYYY',
  'YYYY-MM-DD',
  'MM/DD/YYYY',
]

const emptyMapping: ColumnMapping = {
  date: null,
  description: null,
  amount: null,
  debit: null,
  credit: null,
  category: null,
}

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
}

function ColumnSelect({
  label,
  required,
  headers,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  headers: string[]
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
        {label}
        {required ? '' : ' (optional)'}
      </label>
      <select
        value={value === null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? null : Number.parseInt(v, 10))
        }}
        className={`${importSelectClass} w-full`}
      >
        <option value="">— not present —</option>
        {headers.map((header, index) => (
          <option key={`${header}-${index}`} value={index}>
            {header}
          </option>
        ))}
      </select>
    </div>
  )
}

function duplicateLabel(kind: MappedImportRow['duplicateKind']): string | null {
  if (kind === 'existing') return 'Possible duplicate of existing entry'
  if (kind === 'in_file') return 'Duplicate row in file'
  return null
}

export function CsvImportModal({ open, onClose }: CsvImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const existingEntries = useLedgerStore((s) => s.entries)
  const importEntries = useLedgerStore((s) => s.importEntries)
  const addToast = useToastStore((s) => s.addToast)

  const [step, setStep] = useState<Step>('file')
  const [parseError, setParseError] = useState<string | null>(null)
  const [table, setTable] = useState<ParsedCsvTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping)
  const [amountMode, setAmountMode] = useState<AmountMode>('single')
  const [dateFormat, setDateFormat] = useState<CsvDateFormat>('DD/MM/YYYY')
  const [previewRows, setPreviewRows] = useState<MappedImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  function resetAll() {
    setStep('file')
    setParseError(null)
    setTable(null)
    setMapping(emptyMapping)
    setAmountMode('single')
    setDateFormat('DD/MM/YYYY')
    setPreviewRows([])
    setImporting(false)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    if (importing) return
    resetAll()
    onClose()
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setParseError(null)

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && !results.data.length) {
          setParseError(
            results.errors[0]?.message || "Couldn't parse that CSV file.",
          )
          setTable(null)
          return
        }

        const parsed = tableFromRawRows(results.data as string[][])
        if (!parsed || parsed.rows.length === 0) {
          setParseError('No data rows found in that CSV.')
          setTable(null)
          return
        }

        const detected = autoDetectMapping(parsed.headers)
        setTable(parsed)
        setMapping(detected.mapping)
        setAmountMode(detected.amountMode)
        setStep('mapping')
      },
      error: (error) => {
        setParseError(error.message || "Couldn't parse that CSV file.")
        setTable(null)
      },
    })
  }

  function updateMapping<K extends keyof ColumnMapping>(
    key: K,
    value: ColumnMapping[K],
  ) {
    setMapping((current) => ({ ...current, [key]: value }))
  }

  function mappingReady(): boolean {
    if (mapping.date === null || mapping.description === null) return false
    if (amountMode === 'single') return mapping.amount !== null
    return mapping.debit !== null && mapping.credit !== null
  }

  function goToPreview() {
    if (!table || !mappingReady()) return
    const mapped = mapAllCsvRows(table.rows, mapping, amountMode, dateFormat)
    // Prefer in-memory ledger store (already loaded for the active tax year).
    const annotated = annotateDuplicates(
      mapped,
      existingEntries.map((entry) => ({
        date: entry.date,
        description: entry.description,
        amount: entry.amount,
        type: entry.type,
      })),
    )
    setPreviewRows(annotated)
    setImportError(null)
    setStep('preview')
  }

  function toggleRow(sourceIndex: number) {
    setPreviewRows((rows) =>
      rows.map((row) =>
        row.sourceIndex === sourceIndex && row.valid
          ? { ...row, selected: !row.selected }
          : row,
      ),
    )
  }

  function selectAllValidNonDuplicates() {
    setPreviewRows((rows) =>
      rows.map((row) =>
        row.valid ? { ...row, selected: row.duplicateKind === null } : row,
      ),
    )
  }

  function includeDuplicates() {
    setPreviewRows((rows) =>
      rows.map((row) => (row.valid ? { ...row, selected: true } : row)),
    )
  }

  function clearSelection() {
    setPreviewRows((rows) =>
      rows.map((row) => (row.valid ? { ...row, selected: false } : row)),
    )
  }

  const selectedCount = useMemo(
    () => previewRows.filter((row) => row.valid && row.selected).length,
    [previewRows],
  )
  const validCount = useMemo(
    () => previewRows.filter((row) => row.valid).length,
    [previewRows],
  )
  const duplicateCount = useMemo(
    () =>
      previewRows.filter((row) => row.valid && row.duplicateKind !== null)
        .length,
    [previewRows],
  )
  const taxYearSpan = useMemo(() => {
    return formatTaxYearSpanSummary(uniqueTaxYears(previewRows))
  }, [previewRows])

  const previewSample = table?.rows.slice(0, 5) ?? []

  async function handleImport() {
    if (importing || selectedCount === 0) return

    const toImport = previewRows.filter((row) => row.valid && row.selected)
    const entries: LedgerEntry[] = toImport.map((row) => {
      const kind = row.kind!
      return {
        id: crypto.randomUUID(),
        date: row.dateIso!,
        description: row.description.trim(),
        category: resolveImportCategory(
          row.category,
          kind,
          INCOME_CATEGORIES,
          EXPENSE_CATEGORIES,
        ),
        amount: row.amountPence!,
        type: entryKindToLedgerType(kind),
        taxYear: row.taxYear!,
      }
    })

    setImporting(true)
    setImportError(null)

    try {
      await importEntries(entries)
      const count = entries.length
      resetAll()
      onClose()
      addToast({
        message: `Imported ${count} entries`,
      })
    } catch (error) {
      console.error("Couldn't import ledger entries", error)
      setImportError(
        "Couldn't import entries. Nothing was written — you can retry.",
      )
      setImporting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden border border-border bg-bg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
          <h2
            id="csv-import-title"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink"
          >
            Import CSV
            {step === 'mapping'
              ? ' — map columns'
              : step === 'preview'
                ? ' — preview'
                : ''}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            aria-label="Close"
            className="font-mono text-[16px] leading-none text-ink-faint hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {step === 'file' && (
            <div className="space-y-4">
              <p className="font-mono text-[13px] text-ink-secondary">
                Choose a bank or spreadsheet CSV. Nothing is written until you
                confirm import.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full font-mono text-[13px] text-ink file:mr-3 file:rounded-sm file:border file:border-border file:bg-bg-inset file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.08em] file:text-ink"
              />
              {parseError && (
                <p className="font-mono text-[13px] text-expense">{parseError}</p>
              )}
            </div>
          )}

          {step === 'mapping' && table && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
                  Preview (header + first 5 rows)
                </p>
                <div className="overflow-x-auto border border-border">
                  <table className="w-full min-w-max border-collapse font-mono text-[12px]">
                    <thead>
                      <tr className="bg-bg-raised">
                        {table.headers.map((header, index) => (
                          <th
                            key={`h-${index}`}
                            className="border-b border-border px-2 py-1 text-left font-medium text-ink"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewSample.map((row, rowIndex) => (
                        <tr key={`r-${rowIndex}`} className="border-b border-border last:border-b-0">
                          {table.headers.map((_, colIndex) => (
                            <td
                              key={`c-${rowIndex}-${colIndex}`}
                              className="px-2 py-1 text-ink-secondary tabular-nums"
                            >
                              {row[colIndex] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
                  Amount format
                </p>
                <div
                  className="inline-flex rounded-sm border border-border"
                  role="group"
                  aria-label="Amount format"
                >
                  {(
                    [
                      ['single', 'Single amount column'],
                      ['debit_credit', 'Debit / Credit columns'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAmountMode(mode)}
                      className={[
                        'px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
                        amountMode === mode
                          ? 'bg-bg-inset text-ink'
                          : 'bg-bg text-ink-faint hover:text-ink-secondary',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ColumnSelect
                  label="Date"
                  required
                  headers={table.headers}
                  value={mapping.date}
                  onChange={(v) => updateMapping('date', v)}
                />
                <ColumnSelect
                  label="Description"
                  required
                  headers={table.headers}
                  value={mapping.description}
                  onChange={(v) => updateMapping('description', v)}
                />
                {amountMode === 'single' ? (
                  <ColumnSelect
                    label="Amount"
                    required
                    headers={table.headers}
                    value={mapping.amount}
                    onChange={(v) => updateMapping('amount', v)}
                  />
                ) : (
                  <>
                    <ColumnSelect
                      label="Debit"
                      required
                      headers={table.headers}
                      value={mapping.debit}
                      onChange={(v) => updateMapping('debit', v)}
                    />
                    <ColumnSelect
                      label="Credit"
                      required
                      headers={table.headers}
                      value={mapping.credit}
                      onChange={(v) => updateMapping('credit', v)}
                    />
                  </>
                )}
                <ColumnSelect
                  label="Category"
                  headers={table.headers}
                  value={mapping.category}
                  onChange={(v) => updateMapping('category', v)}
                />
                <div>
                  <label className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary">
                    Date format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) =>
                      setDateFormat(e.target.value as CsvDateFormat)
                    }
                    className={`${importSelectClass} w-full`}
                  >
                    {DATE_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[13px] text-ink">
                  {selectedCount} of {validCount} rows selected
                  <span className="text-ink-faint">
                    {' '}
                    ({previewRows.length} total)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllValidNonDuplicates}
                    disabled={importing}
                    className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Select all valid
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={includeDuplicates}
                      disabled={importing}
                      className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Include duplicates
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={importing}
                    className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {taxYearSpan && (
                <p className="font-mono text-[12px] text-ink-faint">
                  {taxYearSpan}
                </p>
              )}

              {importError && (
                <p className="font-mono text-[13px] text-expense">{importError}</p>
              )}

              <div className="max-h-[50vh] overflow-auto border border-border">
                <table className="w-full border-collapse font-mono text-[12px]">
                  <thead className="sticky top-0 bg-bg-raised">
                    <tr>
                      <th className="border-b border-border px-2 py-1 text-left">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="border-b border-border px-2 py-1 text-left text-ink-secondary">
                        Date
                      </th>
                      <th className="border-b border-border px-2 py-1 text-left text-ink-secondary">
                        Tax year
                      </th>
                      <th className="border-b border-border px-2 py-1 text-left text-ink-secondary">
                        Description
                      </th>
                      <th className="border-b border-border px-2 py-1 text-left text-ink-secondary">
                        Type
                      </th>
                      <th className="border-b border-border px-2 py-1 text-right text-ink-secondary">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const dup = duplicateLabel(row.duplicateKind)
                      return (
                        <tr
                          key={row.sourceIndex}
                          className={[
                            'border-b border-border last:border-b-0',
                            row.valid ? '' : 'bg-bg-inset text-ink-faint',
                          ].join(' ')}
                          title={row.reason ?? dup ?? undefined}
                        >
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={row.valid && row.selected}
                              disabled={!row.valid || importing}
                              onChange={() => toggleRow(row.sourceIndex)}
                              className="size-3.5 rounded-[2px] border border-border accent-ink"
                            />
                          </td>
                          <td className="px-2 py-1 tabular-nums">
                            {row.dateDisplay ?? '—'}
                          </td>
                          <td className="px-2 py-1 tabular-nums">
                            {row.taxYear ?? '—'}
                          </td>
                          <td className="px-2 py-1">
                            {row.description || '—'}
                            {!row.valid && row.reason && (
                              <span className="mt-0.5 block text-[11px]">
                                {row.reason}
                              </span>
                            )}
                            {row.valid && dup && (
                              <span className="mt-0.5 block text-[11px] text-ink-faint">
                                {dup}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            {row.kind === 'income'
                              ? 'Income'
                              : row.kind === 'expense'
                                ? 'Expense'
                                : '—'}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {row.amountPence !== null
                              ? formatPence(row.amountPence)
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div>
            {step !== 'file' && (
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  if (step === 'preview') setStep('mapping')
                  else {
                    resetAll()
                  }
                }}
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-secondary hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={importing}
              className="rounded-sm border border-border bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            {step === 'mapping' && (
              <button
                type="button"
                disabled={!mappingReady()}
                onClick={goToPreview}
                className="rounded-sm border border-border bg-bg-inset px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink disabled:cursor-not-allowed disabled:opacity-60 hover:bg-bg"
              >
                Preview
              </button>
            )}
            {step === 'preview' && (
              <button
                type="button"
                disabled={importing || selectedCount === 0}
                onClick={() => {
                  void handleImport()
                }}
                className="rounded-sm border border-border bg-bg-inset px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink disabled:cursor-not-allowed disabled:opacity-60 hover:bg-bg"
              >
                {importing
                  ? 'Importing…'
                  : `Import ${selectedCount} entries`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
