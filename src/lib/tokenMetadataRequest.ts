export const MAX_TOKEN_METADATA_ADDRESSES = 96
export const MAX_TOKEN_METADATA_TEXT_LENGTH = 96

export interface TokenMetadataRequest {
  addresses: `0x${string}`[]
  requestedCount: number
  truncated: boolean
}

export function buildTokenMetadataRequest(
  addresses: readonly `0x${string}`[],
  limit = MAX_TOKEN_METADATA_ADDRESSES,
): TokenMetadataRequest {
  const unique = Array.from(
    new Set(addresses.map((address) => address.toLowerCase() as `0x${string}`)),
  )
  const safeLimit = Math.max(0, Math.floor(limit))

  return {
    addresses: unique.slice(0, safeLimit),
    requestedCount: unique.length,
    truncated: unique.length > safeLimit,
  }
}

export function normalizeTokenMetadataAddresses(addresses: readonly `0x${string}`[]): `0x${string}`[] {
  return buildTokenMetadataRequest(addresses).addresses
}

export function getTokenMetadataRequestKey(addresses: readonly `0x${string}`[]): string {
  return normalizeTokenMetadataAddresses(addresses).join(',')
}

export function sanitizeTokenMetadataText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!normalized) return fallback
  return normalized.slice(0, MAX_TOKEN_METADATA_TEXT_LENGTH)
}
