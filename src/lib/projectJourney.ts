export const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
export const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function validAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && ADDRESS_PATTERN.test(value) && value.toLowerCase() !== ZERO_ADDRESS
}

export function projectLinks(token: string) {
  if (!validAddress(token)) throw new Error('Enter a valid token address.')
  const address = token.toLowerCase()
  return {
    project: `/projects/${address}`,
    pool: `/swap?createPool=1&token0=${address}`,
    presale: `/launchpad?tab=create&token=${address}`,
    vesting: `/vesting?token=${address}`,
    airdrop: `/airdrop?token=${address}`,
    explorer: `/explorer/token/${address}`,
  }
}

export function readAddressParameter(key = 'token'): string {
  if (typeof window === 'undefined') return ''
  const value = new URLSearchParams(window.location.search).get(key)
  return validAddress(value) ? value.toLowerCase() : ''
}

export function safeReturnPath(value: unknown): string {
  // Setup links return to a known tool; never pass a supplied URL to navigation.
  const destinations = ['/projects', '/launch', '/launchpad', '/swap', '/pool', '/locker', '/vesting', '/airdrop', '/portfolio', '/ledger']
  return destinations.find(destination => destination === value) ?? '/projects'
}

export function lockVerificationLink(locker: string, id: string): string {
  if (!validAddress(locker) || !/^(0|[1-9][0-9]{0,77})$/.test(id) || BigInt(id) >= 2n ** 256n) {
    throw new Error('This lock link is invalid.')
  }
  return `/locker/verify?chain=4441&contract=${locker.toLowerCase()}&id=${id}`
}

export function restoreFormDraft<T extends object>(raw: unknown, defaults: T): T {
  if (typeof raw !== 'string' || raw.length > 16_384) return defaults
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
    const restored = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const next = (value as Record<string, unknown>)[key as string]
      if (typeof next !== typeof defaults[key]) continue
      if (typeof next === 'string' && next.length > 2_048) continue
      if (typeof next === 'number' && !Number.isFinite(next)) continue
      restored[key] = next as T[keyof T]
    }
    return restored
  } catch { return defaults }
}
