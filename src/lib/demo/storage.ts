/**
 * Tiny localStorage helpers for the demo. Everything lives in the visitor's
 * own browser — there is no server-side database in this version.
 * Every access is wrapped in try/catch so private windows still work
 * (data then lives in memory until the tab closes).
 */
const PREFIX = 'pt.demo.v1.'

const memory = new Map<string, string>()

export function readJson<T>(key: string, fallback: T): T {
  const full = PREFIX + key
  try {
    const raw = localStorage.getItem(full) ?? memory.get(full) ?? null
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    const raw = memory.get(full)
    if (raw === undefined) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
}

export function writeJson(key: string, value: unknown): void {
  const full = PREFIX + key
  const raw = JSON.stringify(value)
  memory.set(full, raw)
  try {
    localStorage.setItem(full, raw)
  } catch {
    // storage blocked or full — memory copy still works for this session
  }
}

export function removeKey(key: string): void {
  const full = PREFIX + key
  memory.delete(full)
  try {
    localStorage.removeItem(full)
  } catch {
    // ignore
  }
}

/** Remove every demo key (used by "Reset demo"). */
export function clearAllDemoData(): void {
  memory.clear()
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

export function newId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = (Math.random() * 16) | 0
    return (c === 'x' ? n : (n & 0x3) | 0x8).toString(16)
  })
}
