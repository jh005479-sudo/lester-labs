import { createPublicClient, http, keccak256, type Address } from 'viem'
import { litvm } from '@/config/chains'
import { ILO_ABI, ILO_FACTORY_ABI } from '@/config/abis'
import {
  APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
  APPROVED_ILO_CREATION_CONNECTOR_ADDRESS,
  APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
  APPROVED_ILO_CREATION_FACTORY_ADDRESS,
  APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
  APPROVED_LESTER_TREASURY_ADDRESS,
  LITVM_CURRENT_CONTRACTS,
  LITVM_CURRENT_RUNTIME_CODE_HASHES,
  LITVM_LEGACY_ILO_FACTORIES,
  POST_COMPROMISE_REPLACEMENTS_ACTIVE,
  isCanonicalLitvmContract,
  type LitvmContractAddress,
  type RuntimeCodeHash,
} from '@/config/contracts'

const client = createPublicClient({
  chain: litvm,
  transport: http(litvm.rpcUrls.default.http[0], { retryCount: 0, timeout: 6_000 }),
})

const ILO_ROUTING_ABI = [
  { inputs: [], name: 'router', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'connector', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const

const FACTORY_ROUTING_ABI = [
  ...ILO_ROUTING_ABI,
  { inputs: [], name: 'treasury', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
] as const

interface IloSourceDescriptor {
  id: string
  kind: 'current' | 'legacy'
  address: LitvmContractAddress
  factoryRuntimeCodeHash: RuntimeCodeHash
  childRuntimeCodeHash: RuntimeCodeHash
  connectorAddress?: LitvmContractAddress
  connectorRuntimeCodeHash?: RuntimeCodeHash
}

export interface AttestedIloProvenance {
  child: Address
  owner: Address
  sourceFactory: LitvmContractAddress
  sourceId: string
  sourceKind: 'current' | 'legacy'
}

function currentIloSource(): IloSourceDescriptor | undefined {
  if (
    !POST_COMPROMISE_REPLACEMENTS_ACTIVE ||
    !APPROVED_ILO_CREATION_FACTORY_ADDRESS ||
    !APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH ||
    !APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH ||
    !APPROVED_ILO_CREATION_CONNECTOR_ADDRESS ||
    !APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH
  ) return undefined

  return {
    id: 'current',
    kind: 'current',
    address: APPROVED_ILO_CREATION_FACTORY_ADDRESS,
    factoryRuntimeCodeHash: APPROVED_ILO_CREATION_FACTORY_RUNTIME_CODE_HASH,
    childRuntimeCodeHash: APPROVED_ILO_CREATION_CHILD_RUNTIME_CODE_HASH,
    connectorAddress: APPROVED_ILO_CREATION_CONNECTOR_ADDRESS,
    connectorRuntimeCodeHash: APPROVED_ILO_CREATION_CONNECTOR_RUNTIME_CODE_HASH,
  }
}

function iloSources(): readonly IloSourceDescriptor[] {
  const current = currentIloSource()
  return [
    ...(current ? [current] : []),
    ...LITVM_LEGACY_ILO_FACTORIES.map((deployment) => ({
      id: deployment.id,
      kind: 'legacy' as const,
      address: deployment.address,
      factoryRuntimeCodeHash: deployment.runtimeCodeHash,
      childRuntimeCodeHash: deployment.childRuntimeCodeHash,
      connectorAddress: deployment.connectorAddress,
      connectorRuntimeCodeHash: deployment.connectorRuntimeCodeHash,
    })),
  ]
}

async function hasExactRuntime(
  address: Address,
  expectedRuntimeCodeHash: RuntimeCodeHash,
): Promise<boolean> {
  const code = await client.getCode({ address })
  return Boolean(
    code &&
    code !== '0x' &&
    keccak256(code).toLowerCase() === expectedRuntimeCodeHash.toLowerCase(),
  )
}

export function isTrustedIloFactoryConfigured(): boolean {
  return iloSources().length > 0
}

/**
 * Attest one ILO against the factory address reported by that child. This is
 * deliberately source-specific: an unavailable or modified unrelated legacy
 * factory cannot bless or block a child created by another reviewed factory.
 */
export async function attestIloProvenance(
  iloAddress: Address,
  {
    expectedSourceFactory,
    requiredKind = 'any',
  }: {
    expectedSourceFactory?: Address
    requiredKind?: 'any' | 'current' | 'legacy'
  } = {},
): Promise<AttestedIloProvenance> {
  const [childCode, owner, childFactory] = await Promise.all([
    client.getCode({ address: iloAddress }),
    client.readContract({ address: iloAddress, abi: ILO_ABI, functionName: 'owner' }),
    client.readContract({ address: iloAddress, abi: ILO_ABI, functionName: 'factory' }),
  ])
  if (!childCode || childCode === '0x') throw new Error('The reported ILO child has no runtime bytecode.')

  const source = iloSources().find((candidate) => (
    isCanonicalLitvmContract(childFactory, candidate.address) &&
    (!expectedSourceFactory || isCanonicalLitvmContract(candidate.address, expectedSourceFactory))
  ))
  if (!source || (requiredKind !== 'any' && source.kind !== requiredKind)) {
    throw new Error('The ILO child does not report the selected source-pinned factory.')
  }

  const [factoryCode, ownerRegistry] = await Promise.all([
    client.getCode({ address: source.address }),
    client.readContract({
      address: source.address,
      abi: ILO_FACTORY_ABI,
      functionName: 'getOwnerILOs',
      args: [owner],
    }),
  ])
  if (
    !factoryCode ||
    factoryCode === '0x' ||
    keccak256(factoryCode).toLowerCase() !== source.factoryRuntimeCodeHash.toLowerCase()
  ) throw new Error('The reported source ILO factory runtime does not match reviewed source.')
  if (keccak256(childCode).toLowerCase() !== source.childRuntimeCodeHash.toLowerCase()) {
    throw new Error('The ILO child runtime does not match the generation emitted by its reported factory.')
  }
  if (!ownerRegistry.some((entry) => isCanonicalLitvmContract(entry, iloAddress))) {
    throw new Error('The reported source factory does not register this ILO under its on-chain owner.')
  }

  if (source.connectorAddress && source.connectorRuntimeCodeHash) {
    const [connectorMatches, childConnector] = await Promise.all([
      hasExactRuntime(source.connectorAddress, source.connectorRuntimeCodeHash),
      client.readContract({ address: iloAddress, abi: ILO_ROUTING_ABI, functionName: 'connector' }),
    ])
    if (!connectorMatches || !isCanonicalLitvmContract(childConnector, source.connectorAddress)) {
      throw new Error('The ILO connector reference/runtime does not match its source-pinned generation.')
    }
  }

  if (source.kind === 'current') {
    const [childRouter, childTreasury] = await Promise.all([
      client.readContract({ address: iloAddress, abi: ILO_ROUTING_ABI, functionName: 'router' }),
      client.readContract({ address: iloAddress, abi: ILO_ABI, functionName: 'treasury' }),
    ])
    if (
      !isCanonicalLitvmContract(childRouter, LITVM_CURRENT_CONTRACTS.uniswapV2Router) ||
      !APPROVED_LESTER_TREASURY_ADDRESS ||
      !isCanonicalLitvmContract(childTreasury, APPROVED_LESTER_TREASURY_ADDRESS)
    ) throw new Error('The replacement ILO child routing does not match the approved router and treasury.')
  }

  return {
    child: iloAddress,
    owner,
    sourceFactory: source.address,
    sourceId: source.id,
    sourceKind: source.kind,
  }
}

export async function attestApprovedIloFactoryRouting(): Promise<void> {
  const source = currentIloSource()
  if (!source || !source.connectorAddress || !source.connectorRuntimeCodeHash || !APPROVED_LESTER_TREASURY_ADDRESS) {
    throw new Error('Replacement ILO routing is not fully source-pinned.')
  }

  const [factoryMatches, connectorMatches, routerMatches, factoryConnector, factoryRouter, factoryTreasury] = await Promise.all([
    hasExactRuntime(source.address, source.factoryRuntimeCodeHash),
    hasExactRuntime(source.connectorAddress, source.connectorRuntimeCodeHash),
    hasExactRuntime(LITVM_CURRENT_CONTRACTS.uniswapV2Router, LITVM_CURRENT_RUNTIME_CODE_HASHES.uniswapV2Router),
    client.readContract({ address: source.address, abi: FACTORY_ROUTING_ABI, functionName: 'connector' }),
    client.readContract({ address: source.address, abi: FACTORY_ROUTING_ABI, functionName: 'router' }),
    client.readContract({ address: source.address, abi: FACTORY_ROUTING_ABI, functionName: 'treasury' }),
  ])
  if (
    !factoryMatches ||
    !connectorMatches ||
    !routerMatches ||
    !isCanonicalLitvmContract(factoryConnector, source.connectorAddress) ||
    !isCanonicalLitvmContract(factoryRouter, LITVM_CURRENT_CONTRACTS.uniswapV2Router) ||
    !isCanonicalLitvmContract(factoryTreasury, APPROVED_LESTER_TREASURY_ADDRESS)
  ) throw new Error('Replacement ILO factory routing does not match the source-pinned factory/connector/router/treasury tuple.')
}

export async function isFactoryCreatedIlo(iloAddress: Address): Promise<boolean> {
  try {
    await attestIloProvenance(iloAddress)
    return true
  } catch {
    return false
  }
}
