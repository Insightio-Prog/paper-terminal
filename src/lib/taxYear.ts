/** UK tax year label for a date (e.g. "2025–26"). Year runs 6 Apr – 5 Apr. */
export function dateToTaxYear(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  const isOnOrAfterStart = month > 4 || (month === 4 && day >= 6);
  const startYear = isOnOrAfterStart ? year : year - 1;
  const endSuffix = String((startYear + 1) % 100).padStart(2, "0");

  return `${startYear}–${endSuffix}`;
}

/** Current UK tax year label. */
export function currentTaxYear(): string {
  return dateToTaxYear(new Date().toISOString().slice(0, 10));
}

/** Tax year options centred on the current year. */
export function taxYearOptions(count = 5): string[] {
  const current = currentTaxYear();
  const startYear = Number.parseInt(current.split("–")[0], 10);
  const years: string[] = [];

  for (let i = -1; i < count - 1; i++) {
    const y = startYear + i;
    const endSuffix = String((y + 1) % 100).padStart(2, "0");
    years.push(`${y}–${endSuffix}`);
  }

  return years;
}
