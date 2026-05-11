export function normalizeTokenMetadataAddresses(addresses: readonly `0x${string}`[]): `0x${string}`[] {
  return Array.from(
    new Set(addresses.map((address) => address.toLowerCase() as `0x${string}`)),
  )
}

export function getTokenMetadataRequestKey(addresses: readonly `0x${string}`[]): string {
  return normalizeTokenMetadataAddresses(addresses).join(',')
}
