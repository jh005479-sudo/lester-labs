const MAX_EXTERNAL_URL_LENGTH = 2_048

export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate || candidate.length > MAX_EXTERNAL_URL_LENGTH) return null

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}
