export interface AddressLabel {
  address: string
  label: string
  type: 'protocol' | 'bridge' | 'deployer' | 'token' | 'multisig' | 'faucet' | 'exchange' | 'unknown'
  description: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const knownLabels: AddressLabel[] = [
  {
    address: ZERO_ADDRESS,
    label: 'Burn Address',
    type: 'protocol',
    description: 'The zero address used for token burns',
  },
]

const labelMap = new Map(knownLabels.map((l) => [l.address.toLowerCase(), l]))

export function getLabel(address: string): AddressLabel | null {
  return labelMap.get(address.toLowerCase()) ?? null
}

export function inferLabel(address: string, txCount: number): AddressLabel {
  const known = getLabel(address)
  if (known) return known

  if (txCount > 1000) {
    return {
      address,
      label: 'High Activity Address',
      type: 'unknown',
      description: `Address with ${txCount.toLocaleString()} transactions`,
    }
  }

  return { address, label: 'Unknown', type: 'unknown', description: '' }
}

export const METHOD_SIGS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
  '0x38ed1739': 'swap',
  '0x8803dbee': 'swap',
  '0x7ff36ab5': 'swap',
  '0x18cbafe5': 'swap',
  '0x40c10f19': 'mint',
  '0xa0712d68': 'mint',
  '0xd0e30db0': 'deposit',
  '0x2e1a7d4d': 'withdraw',
  '0xe8e33700': 'addLiquidity',
  '0xf305d719': 'addLiquidityETH',
  '0x2195995c': 'removeLiquidity',
  '0x31863c6f': 'transferFrom',
  '0x23b872dd': 'transferFrom',
  '0x5ae401dc': 'multicall',
  '0xac9650d8': 'multicall',
  '0x3593564c': 'execute',
  '0x00aeef8a': 'wrap',
  '0x2d9a7a7f': 'unwrap',
}

export function decodeMethod(input: string): string {
  if (!input || input.length < 10) return 'Transfer'
  const sig = input.slice(0, 10)
  return METHOD_SIGS[sig] ?? sig
}
