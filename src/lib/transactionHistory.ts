import { HASH_PATTERN, validAddress } from './projectJourney.ts'

export type TransactionStage = 'checking' | 'wallet' | 'submitted' | 'confirmed' | 'reverted' | 'cancelled' | 'failed' | 'unknown'
export interface TrackedTransaction {
  id: string
  chainId: 4441
  account: string
  target: string
  action: string
  asset?: string
  projectName?: string
  hash?: `0x${string}`
  inputHash?: `0x${string}`
  value?: string
  stage: TransactionStage
  createdAt: number
  updatedAt: number
}
export const TRANSACTION_STORAGE_KEY = 'lester:transactions:v1'
export const TRANSACTION_EVENT = 'lester:transactions-changed'
const stages = new Set<TransactionStage>(['checking', 'wallet', 'submitted', 'confirmed', 'reverted', 'cancelled', 'failed', 'unknown'])

export function parseTransactionHistory(raw: string | null): TrackedTransaction[] {
  if (!raw || raw.length > 128_000) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((entry): entry is TrackedTransaction => Boolean(
      entry && typeof entry === 'object' && typeof entry.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(entry.id) &&
      entry.chainId === 4441 && validAddress(entry.account) && validAddress(entry.target) &&
      typeof entry.action === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(entry.action) &&
      (entry.asset === undefined || validAddress(entry.asset)) &&
      (entry.projectName === undefined || typeof entry.projectName === 'string' && entry.projectName.length <= 50) &&
      (entry.inputHash === undefined || typeof entry.inputHash === 'string' && HASH_PATTERN.test(entry.inputHash)) &&
      (entry.value === undefined || typeof entry.value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(entry.value)) &&
      (entry.hash === undefined || HASH_PATTERN.test(entry.hash)) && stages.has(entry.stage) &&
      Number.isSafeInteger(entry.createdAt) && entry.createdAt > 0 && Number.isSafeInteger(entry.updatedAt) && entry.updatedAt > 0 &&
      (!['submitted', 'confirmed', 'reverted'].includes(entry.stage) || entry.hash)
    )).slice(0, 100)
  } catch { return [] }
}

export function transactionLabel(action: string): string {
  const labels: Record<string, string> = {
    approve: 'Token approval', createToken: 'Create token', lockLiquidity: 'Lock liquidity', withdraw: 'Withdraw lock',
    createVestingSchedule: 'Create vesting schedule', release: 'Claim vested tokens', createILO: 'Create presale',
    post: 'Post message', disperseToken: 'Send tokens', disperseEther: 'Send test zkLTC', postMessage: 'Post message',
    addLiquidity: 'Add liquidity', addLiquidityETH: 'Add liquidity', removeLiquidity: 'Remove liquidity',
    removeLiquidityETH: 'Remove liquidity', swapExactETHForTokens: 'Swap', swapExactTokensForETH: 'Swap',
    swapExactTokensForTokens: 'Swap', deposit: 'Wrap zkLTC', contribute: 'Join presale', finalize: 'Finalize presale',
  }
  return labels[action] ?? action.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function saveTrackedTransaction(entry: TrackedTransaction): void {
  if (typeof window === 'undefined') return
  try {
    const previous = parseTransactionHistory(localStorage.getItem(TRANSACTION_STORAGE_KEY))
    const next = parseTransactionHistory(JSON.stringify([entry, ...previous.filter((item) => item.id !== entry.id)]))
    localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(TRANSACTION_EVENT))
  } catch { /* A storage failure must never interrupt an already-submitted transaction. */ }
}

export function hasUnresolvedDuplicate(entries: readonly TrackedTransaction[], candidate: TrackedTransaction): boolean {
  return Boolean(candidate.inputHash && entries.some((entry) =>
    ['submitted', 'unknown'].includes(entry.stage) && entry.account.toLowerCase() === candidate.account.toLowerCase() &&
    entry.target.toLowerCase() === candidate.target.toLowerCase() && entry.inputHash === candidate.inputHash && entry.value === candidate.value,
  ))
}

/** Called only after the tracked creation receipt has been checked. */
export function saveConfirmedProject(entry: TrackedTransaction): void {
  if (entry.stage !== 'confirmed' || entry.action !== 'createToken' || !validAddress(entry.asset) || !entry.projectName || typeof window === 'undefined') return
  try {
    const key = 'lester:projects:v1'
    const raw = localStorage.getItem(key)
    const stored: unknown = raw && raw.length < 20_000 ? JSON.parse(raw) : []
    const previous = Array.isArray(stored) ? stored.filter((item) => validAddress(item?.token) && typeof item.name === 'string' && item.name.length <= 50 && item.token.toLowerCase() !== entry.asset!.toLowerCase()).slice(0, 19) : []
    localStorage.setItem(key, JSON.stringify([{token:entry.asset.toLowerCase(),name:entry.projectName,hash:entry.hash,createdAt:entry.createdAt},...previous]))
    window.dispatchEvent(new Event('lester:projects-changed'))
  } catch { /* The public project page remains available by token address. */ }
}
