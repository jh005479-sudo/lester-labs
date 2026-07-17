import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import { litvm } from '@/config/chains'
import { ILO_FACTORY_ABI } from '@/config/abis'
import { ILO_FACTORY_ADDRESS, LITVM_TESTNET_CONTRACTS, isCanonicalLitvmContract } from '@/config/contracts'
import { getRecentWindowIndices } from '@/lib/launchpadPagination'

const ILO_CREATED_EVENT = parseAbiItem(
  'event ILOCreated(address indexed ilo, address indexed token, address indexed owner, uint256 softCap, uint256 hardCap)',
)

const client = createPublicClient({
  chain: litvm,
  transport: http(litvm.rpcUrls.default.http[0], { retryCount: 0, timeout: 6_000 }),
})

const RECENT_FACTORY_ILO_CHECK = 256
const FACTORY_READ_BATCH_SIZE = 24

export function isTrustedIloFactoryConfigured(): boolean {
  return isCanonicalLitvmContract(ILO_FACTORY_ADDRESS, LITVM_TESTNET_CONTRACTS.iloFactory)
}

export async function isFactoryCreatedIlo(iloAddress: Address): Promise<boolean> {
  if (!isTrustedIloFactoryConfigured()) return false

  const [code, count] = await Promise.all([
    client.getCode({ address: iloAddress }),
    client.readContract({
      address: LITVM_TESTNET_CONTRACTS.iloFactory,
      abi: ILO_FACTORY_ABI,
      functionName: 'getILOCount',
    }),
  ])

  if (!code || code === '0x') return false

  const recentIndices = getRecentWindowIndices(Number(count), RECENT_FACTORY_ILO_CHECK)
  for (let offset = 0; offset < recentIndices.length; offset += FACTORY_READ_BATCH_SIZE) {
    const batch = recentIndices.slice(offset, offset + FACTORY_READ_BATCH_SIZE)
    const recentEntries = await Promise.allSettled(batch.map((index) => client.readContract({
      address: LITVM_TESTNET_CONTRACTS.iloFactory,
      abi: ILO_FACTORY_ABI,
      functionName: 'allILOs',
      args: [index],
    })))

    if (recentEntries.some((entry) => (
      entry.status === 'fulfilled'
      && entry.value.toLowerCase() === iloAddress.toLowerCase()
    ))) {
      return true
    }
  }

  const logs = await client.getLogs({
    address: LITVM_TESTNET_CONTRACTS.iloFactory,
    event: ILO_CREATED_EVENT,
    args: { ilo: iloAddress },
    fromBlock: 0n,
    toBlock: 'latest',
    strict: true,
  })

  return logs.length > 0
}
