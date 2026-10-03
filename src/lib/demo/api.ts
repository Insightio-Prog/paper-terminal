/** Base URL of the locked-down demo Worker (see worker/ and .env.example). */
export function demoApiUrl(): string {
  const url = import.meta.env.VITE_DEMO_API_URL
  if (!url) {
    throw new Error('The demo AI service is not configured.')
  }
  return url.replace(/\/$/, '')
}

/** Friendly message for a non-OK response from the demo Worker. */
export function demoApiErrorMessage(status: number): string {
  if (status === 429) {
    return 'Claude is taking a breather: the demo limit was reached. Try again later.'
  }
  if (status === 402 || status === 529) {
    return "The demo's AI budget is used up for today. Everything else still works!"
  }
  return "Claude couldn't respond just now. Try again in a moment."
}
