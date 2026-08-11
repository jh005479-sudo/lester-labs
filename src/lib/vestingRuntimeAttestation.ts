import { keccak256, type Hex } from 'viem'

interface ImmutableRuntimeReference {
  start: number
  length: number
}

type VestingChildRuntimeAttestation =
  | { kind: 'exact-runtime-hashes'; runtimeCodeHashes: readonly `0x${string}`[] }
  | {
      kind: 'immutable-template'
      normalizedRuntimeCodeHash: `0x${string}`
      runtimeCodeBytes: number
      immutableReferences: readonly ImmutableRuntimeReference[]
    }

const RUNTIME_PATTERN = /^0x(?:[0-9a-fA-F]{2})+$/

/**
 * Replaces only compiler-attested immutable byte ranges with zeroes. Solidity
 * emits those locations as schedule-specific values in VestingWallet runtime
 * code, while the remainder of the runtime must match the reviewed template.
 */
export function normalizeImmutableRuntime(
  runtimeCode: Hex,
  runtimeCodeBytes: number,
  immutableReferences: readonly ImmutableRuntimeReference[],
): Hex {
  if (!RUNTIME_PATTERN.test(runtimeCode) || (runtimeCode.length - 2) / 2 !== runtimeCodeBytes) {
    throw new Error('VestingWallet runtime length does not match the source-pinned template.')
  }
  const normalized = runtimeCode.slice(2).toLowerCase().split('')
  const coveredBytes = new Set<number>()
  for (const reference of immutableReferences) {
    if (
      !Number.isSafeInteger(reference.start) ||
      !Number.isSafeInteger(reference.length) ||
      reference.start < 0 ||
      reference.length <= 0 ||
      reference.start + reference.length > runtimeCodeBytes
    ) throw new Error('VestingWallet immutable reference is outside the runtime template.')
    for (let offset = reference.start; offset < reference.start + reference.length; offset += 1) {
      if (coveredBytes.has(offset)) throw new Error('VestingWallet immutable references overlap.')
      coveredBytes.add(offset)
      normalized[offset * 2] = '0'
      normalized[(offset * 2) + 1] = '0'
    }
  }
  if (coveredBytes.size === 0) throw new Error('VestingWallet immutable references are missing.')
  return `0x${normalized.join('')}`
}

export function isAttestedVestingWalletRuntime(
  runtimeCode: Hex | undefined,
  attestation: VestingChildRuntimeAttestation,
): boolean {
  if (!runtimeCode || runtimeCode === '0x') return false
  if (attestation.kind === 'exact-runtime-hashes') {
    const runtimeHash = keccak256(runtimeCode).toLowerCase()
    return attestation.runtimeCodeHashes.some((expected) => runtimeHash === expected.toLowerCase())
  }
  try {
    return keccak256(normalizeImmutableRuntime(
      runtimeCode,
      attestation.runtimeCodeBytes,
      attestation.immutableReferences,
    )).toLowerCase() === attestation.normalizedRuntimeCodeHash.toLowerCase()
  } catch {
    return false
  }
}
