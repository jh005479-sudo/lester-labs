import { getAccount } from 'wagmi/actions'
import { litvm } from '@/config/chains'
import { wagmiConfig } from '@/config/wagmi'
import {
  assertLitvmWalletChainSnapshot,
  LITVM_LITEFORGE_CHAIN_ID,
} from '@/lib/litvmChainPolicy'

if (litvm.id !== LITVM_LITEFORGE_CHAIN_ID) {
  throw new Error('LitVM chain policy and configured chain ID do not match.')
}

/**
 * Reads the connector directly, rather than trusting only React/config state.
 * The connector chain and account are re-read immediately before every prompt.
 */
export async function attestLitvmWalletChain({
  expectedAddress,
}: {
  expectedAddress?: `0x${string}`
} = {}): Promise<void> {
  const account = getAccount(wagmiConfig)
  if (!account.isConnected || !account.connector || !account.address) {
    assertLitvmWalletChainSnapshot({
      connected: false,
      stateChainId: account.chainId,
      connectorChainId: undefined,
      expectedAddress,
    })
    return
  }

  const [connectorChainId, connectorAccounts] = await Promise.all([
    account.connector.getChainId(),
    account.connector.getAccounts(),
  ])

  assertLitvmWalletChainSnapshot({
    connected: true,
    stateChainId: account.chainId,
    connectorChainId,
    connectedAddress: account.address,
    connectorAccounts,
    expectedAddress,
  })
}
