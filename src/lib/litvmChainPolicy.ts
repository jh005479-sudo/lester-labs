export const LITVM_LITEFORGE_CHAIN_ID = 4441

export interface LitvmWalletChainSnapshot {
  connected: boolean
  stateChainId: number | undefined
  connectorChainId: number | undefined
  connectedAddress?: `0x${string}`
  connectorAccounts?: readonly `0x${string}`[]
  expectedAddress?: `0x${string}`
}

export function assertLitvmChainId(chainId: unknown): asserts chainId is number {
  if (chainId !== LITVM_LITEFORGE_CHAIN_ID) {
    throw new Error(`Wallet action blocked: expected LitVM LiteForge (Chain ID ${LITVM_LITEFORGE_CHAIN_ID}).`)
  }
}

export function assertRequestedLitvmChainId(requestedChainId: unknown): void {
  if (requestedChainId !== undefined && requestedChainId !== LITVM_LITEFORGE_CHAIN_ID) {
    throw new Error(`Wallet action requested an unapproved chain. Only LitVM LiteForge (Chain ID ${LITVM_LITEFORGE_CHAIN_ID}) is permitted.`)
  }
}

/** Pure chain/account gate used by the runtime guard and regression tests. */
export function assertLitvmWalletChainSnapshot(snapshot: LitvmWalletChainSnapshot): void {
  if (!snapshot.connected) throw new Error('Connect a wallet before requesting a wallet action.')
  if (
    snapshot.stateChainId !== LITVM_LITEFORGE_CHAIN_ID ||
    snapshot.connectorChainId !== LITVM_LITEFORGE_CHAIN_ID
  ) {
    throw new Error(`Wallet action blocked: the application and injected wallet must both report LitVM LiteForge (Chain ID ${LITVM_LITEFORGE_CHAIN_ID}).`)
  }

  if (snapshot.expectedAddress) {
    if (
      !snapshot.connectedAddress ||
      snapshot.connectedAddress.toLowerCase() !== snapshot.expectedAddress.toLowerCase()
    ) {
      throw new Error('Wallet action blocked because the connected account changed during preflight.')
    }

    if (
      !snapshot.connectorAccounts?.some((account) => (
        account.toLowerCase() === snapshot.expectedAddress!.toLowerCase()
      ))
    ) throw new Error('Wallet action blocked because the injected wallet no longer exposes the preflight account.')
  }

  if (
    !snapshot.connectedAddress ||
    !snapshot.connectorAccounts?.some((account) => (
      account.toLowerCase() === snapshot.connectedAddress!.toLowerCase()
    ))
  ) throw new Error('Wallet action blocked because application and injected-wallet account state do not agree.')
}

/**
 * Places a fresh connector check on both sides of asynchronous preflight work.
 * The final callback must also pin 4441 so the wallet library performs its own
 * provider-chain assertion immediately before transaction submission.
 */
export async function runGuardedLitvmWalletPrompt<result>({
  requestedChainId,
  attestWalletChain,
  preflight,
  prompt,
}: {
  requestedChainId?: unknown
  attestWalletChain: () => Promise<void>
  preflight: () => Promise<void>
  prompt: () => Promise<result>
}): Promise<result> {
  assertRequestedLitvmChainId(requestedChainId)
  await attestWalletChain()
  await preflight()
  await attestWalletChain()
  return prompt()
}
