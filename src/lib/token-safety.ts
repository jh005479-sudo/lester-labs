import { LITVM_RPC_URL } from './explorerRpc'

export interface SafetyCheck {
  name: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail: string
}

export interface SafetyReport {
  score: 'safe' | 'caution' | 'risky'
  checks: SafetyCheck[]
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(LITVM_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  })
  const data = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  return data.result
}

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    return (await rpcCall('eth_call', [{ to, data }, 'latest'])) as string
  } catch {
    return null
  }
}

async function getCode(address: string): Promise<string> {
  try {
    return ((await rpcCall('eth_getCode', [address, 'latest'])) as string) ?? '0x'
  } catch {
    return '0x'
  }
}

// keccak256 first 4 bytes — precomputed well-known selectors
const SELECTORS = {
  // mint(address,uint256) → 0x40c10f19
  mint: '40c10f19',
  // mint(address) → 0x6a627842
  mintTo: '6a627842',
  // pause() → 0x8456cb59
  pause: '8456cb59',
  // paused() → 0x5c975abb
  paused: '5c975abb',
  // owner() → 0x8da5cb5b
  owner: '8da5cb5b',
  // transfer(address,uint256) → 0xa9059cbb
  transfer: 'a9059cbb',
}

function bytecodeHas(bytecode: string, selector: string): boolean {
  // Remove 0x prefix, search for 4-byte selector in bytecode
  const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
  return hex.includes(selector)
}

function decodeAddress(result: string | null): string | null {
  if (!result || result.length < 66) return null
  return '0x' + result.slice(-40)
}

async function isContract(address: string): Promise<boolean> {
  const code = await getCode(address)
  return code !== '0x' && code !== '0x0' && code.length > 4
}

export async function checkTokenSafety(address: string): Promise<SafetyReport> {
  const checks: SafetyCheck[] = []

  // 1. Get bytecode
  const bytecode = await getCode(address)
  const hasCode = bytecode !== '0x' && bytecode.length > 4

  if (!hasCode) {
    return {
      score: 'risky',
      checks: [{ name: 'Contract exists', status: 'fail', detail: 'No bytecode found at this address' }],
    }
  }

  // 2. Mint function check
  const hasMint = bytecodeHas(bytecode, SELECTORS.mint) || bytecodeHas(bytecode, SELECTORS.mintTo)
  checks.push({
    name: 'Mint function',
    status: hasMint ? 'fail' : 'pass',
    detail: hasMint
      ? 'mint() selector found in bytecode — owner may be able to inflate supply'
      : 'No mint() selector detected in bytecode',
  })

  // 3. Pause function check
  const hasPause = bytecodeHas(bytecode, SELECTORS.pause) || bytecodeHas(bytecode, SELECTORS.paused)
  checks.push({
    name: 'Pause function',
    status: hasPause ? 'warn' : 'pass',
    detail: hasPause
      ? 'pause() selector found — owner may be able to freeze transfers'
      : 'No pause() selector detected',
  })

  // 4. Owner is EOA check
  const ownerResult = await ethCall(address, '0x' + SELECTORS.owner)
  const ownerAddr = decodeAddress(ownerResult)
  if (ownerAddr) {
    const ownerIsContract = await isContract(ownerAddr)
    checks.push({
      name: 'Owner is multisig/contract',
      status: ownerIsContract ? 'pass' : 'warn',
      detail: ownerIsContract
        ? `Owner ${ownerAddr.slice(0, 10)}... is a contract (likely multisig or timelock)`
        : `Owner ${ownerAddr.slice(0, 10)}... is an EOA — single key controls contract`,
    })
  } else {
    checks.push({
      name: 'Owner is multisig/contract',
      status: 'unknown',
      detail: 'Unable to verify — owner() call returned no result',
    })
  }

  // 5. Tax simulation — Unable to verify via static RPC without holding tokens
  checks.push({
    name: 'Transfer tax',
    status: 'unknown',
    detail: 'Unable to verify — requires live token balance to simulate transfer',
  })

  // 6. Liquidity locked — check if LP tokens sent to dead address
  // We can check if zero address has been a recipient of Transfer from this contract
  // This is a heuristic: if burn address holds tokens → some supply burned/locked
  const deadAddr = '0x000000000000000000000000000000000000dead'
  const burnCheck = await ethCall(
    address,
    '0x70a08231' + deadAddr.slice(2).padStart(64, '0'),
  )
  let liquidityCheck: SafetyCheck
  if (burnCheck && burnCheck !== '0x' && BigInt(burnCheck) > 0n) {
    liquidityCheck = {
      name: 'Liquidity locked',
      status: 'pass',
      detail: 'Tokens found in dead address — some supply burned/locked',
    }
  } else {
    liquidityCheck = {
      name: 'Liquidity locked',
      status: 'unknown',
      detail: 'Unable to verify liquidity lock status — no burn balance detected',
    }
  }
  checks.push(liquidityCheck)

  // Score calculation
  const hasFail = checks.some(c => c.status === 'fail')
  const warnCount = checks.filter(c => c.status === 'warn').length

  let score: SafetyReport['score']
  if (hasFail) score = 'risky'
  else if (warnCount >= 2) score = 'caution'
  else if (warnCount >= 1) score = 'caution'
  else score = 'safe'

  return { score, checks }
}
