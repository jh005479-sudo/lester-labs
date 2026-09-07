export const USAGE_KINDS = ['task_started', 'wallet_connected', 'transaction_submitted', 'transaction_confirmed', 'transaction_failed'] as const
export const USAGE_SURFACES = ['projects', 'launch', 'launchpad', 'swap', 'pool', 'locker', 'vesting', 'airdrop', 'portfolio', 'ledger', 'other'] as const
export type UsageKind = typeof USAGE_KINDS[number]
export interface UsageEvent { id: string; device: string; session: string; kind: UsageKind; surface: typeof USAGE_SURFACES[number]; traffic: 'browser' | 'development' }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export const USAGE_CONSENT_KEY = 'lester:usage-consent:v1'

export function parseUsageEvent(value: unknown): UsageEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid usage event.')
  const event = value as Record<string, unknown>
  if (Object.keys(event).sort().join(',') !== 'device,id,kind,session,surface,traffic' ||
    ![event.id, event.device, event.session].every((id) => typeof id === 'string' && uuid.test(id)) ||
    !(USAGE_KINDS as readonly unknown[]).includes(event.kind) || !(USAGE_SURFACES as readonly unknown[]).includes(event.surface) ||
    !['browser', 'development'].includes(event.traffic as string)) throw new Error('Invalid usage event.')
  return event as unknown as UsageEvent
}

/** Explicit opt-in. No address, transaction hash, input value, or full URL is collected. */
export function recordUsage(kind: UsageKind, id?: string, source?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(USAGE_CONSENT_KEY) !== 'yes') return
    let device = localStorage.getItem('lester:usage-device:v1')
    let session = sessionStorage.getItem('lester:usage-session:v1')
    if (!device || !uuid.test(device)) { device = crypto.randomUUID(); localStorage.setItem('lester:usage-device:v1', device) }
    if (!session || !uuid.test(session)) { session = crypto.randomUUID(); sessionStorage.setItem('lester:usage-session:v1', session) }
    const route = source ?? window.location.pathname.split('/')[1]
    const surface = (USAGE_SURFACES as readonly string[]).includes(route) ? route as UsageEvent['surface'] : 'other'
    const event = parseUsageEvent({ id: id ?? crypto.randomUUID(), device, session, kind, surface, traffic: process.env.NODE_ENV === 'production' ? 'browser' : 'development' })
    void fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event), keepalive: true }).catch(() => undefined)
  } catch { /* Metrics must never interrupt a user's task. */ }
}

export function transactionSurface(action: string): string {
  if (/swap|deposit/i.test(action)) return 'swap'
  if (action === 'lockLiquidity' || action === 'withdraw') return 'locker'
  if (/Liquidity/.test(action)) return 'pool'
  if (/Vesting|release/.test(action)) return 'vesting'
  if (/disperse/.test(action)) return 'airdrop'
  if (/ILO|contribute|finalize/.test(action)) return 'launchpad'
  if (action === 'createToken') return 'launch'
  if (action === 'post' || action === 'postMessage') return 'ledger'
  return 'other'
}
