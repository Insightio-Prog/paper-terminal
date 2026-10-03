/**
 * Demo replacement for Supabase Storage (receipt photos and the logo).
 * Files are kept as data URLs in the visitor's browser only.
 */
const PREFIX = 'pt.demo.v1.file.'
const memory = new Map<string, string>()

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Couldn't read that file."))
    reader.readAsDataURL(blob)
  })
}

export async function putFile(path: string, blob: Blob): Promise<void> {
  const dataUrl = await blobToDataUrl(blob)
  memory.set(path, dataUrl)
  try {
    localStorage.setItem(PREFIX + path, dataUrl)
  } catch {
    // too big or blocked — the in-memory copy still works this session
  }
}

export function getFileUrl(path: string): string | null {
  const fromMemory = memory.get(path)
  if (fromMemory) return fromMemory
  try {
    return localStorage.getItem(PREFIX + path)
  } catch {
    return null
  }
}

export function removeFile(path: string): void {
  memory.delete(path)
  try {
    localStorage.removeItem(PREFIX + path)
  } catch {
    // ignore
  }
}

export function clearAllFiles(): void {
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
