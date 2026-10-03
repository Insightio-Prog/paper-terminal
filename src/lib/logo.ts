import { getFileUrl, putFile } from './demo/files'

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'

    const cleanup = () => {
      input.remove()
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null
      cleanup()
      resolve(file)
    })

    // If the user cancels, change never fires — clear after focus returns.
    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (document.body.contains(input)) {
            cleanup()
            resolve(null)
          }
        }, 300)
      },
      { once: true },
    )

    document.body.appendChild(input)
    input.click()
  })
}

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName

  const mime = file.type.split('/')[1]
  if (mime === 'jpeg') return 'jpg'
  if (mime) return mime
  return 'png'
}

/** Pick an image and keep it in the visitor's browser (demo storage). */
export async function importLogo(): Promise<string | null> {
  const file = await pickFile()
  if (!file) return null

  const ext = extensionFor(file)
  const path = `logo.${ext}`
  await putFile(path, file)
  return path
}

/** Return a display URL for a stored logo path. */
export async function getLogoUrl(path: string): Promise<string> {
  if (!path) return ''
  return getFileUrl(path) ?? ''
}
