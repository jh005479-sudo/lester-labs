const LITVM_RPC_URL = process.env.NEXT_PUBLIC_LITVM_RPC_URL
  ?? 'https://liteforge.rpc.caldera.xyz/infra-partner-http'

export interface SafetyCheck {
  name: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail: string
}

export interface SafetyReport {
  score: 'safe' | 'caution' | 'risky'
  checks: SafetyCheck[]
}

export const TOKEN_SAFETY_RPC_TIMEOUT_MS = 3_000

export async function rpcCall(method: string, params: unknown[], timeoutMs = TOKEN_SAFETY_RPC_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const safeTimeout = Math.max(1, Math.floor(timeoutMs))
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`Token safety RPC timed out after ${safeTimeout}ms`)),
    safeTimeout,
  )

  try {
    const res = await fetch(LITVM_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Token safety RPC returned HTTP ${res.status}`)
    const data = (await res.json()) as { result?: unknown; error?: { message: string } }
    if (data.error) throw new Error(data.error.message)
    return data.result
  } finally {
    clearTimeout(timeoutId)
  }
}

async function ethCall(to: string, data: string, timeoutMs: number): Promise<string | null> {
  try {
    return (await rpcCall('eth_call', [{ to, data }, 'latest'], timeoutMs)) as string
  } catch {
    return null
  }
}

async function getCode(address: string, timeoutMs: number): Promise<string | null> {
  try {
    const result = await rpcCall('eth_getCode', [address, 'latest'], timeoutMs)
    return typeof result === 'string' ? result : null
  } catch {
    return null
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

async function isContract(address: string, timeoutMs: number): Promise<boolean | null> {
  const code = await getCode(address, timeoutMs)
  if (code === null) return null
  return code !== '0x' && code !== '0x0' && code.length > 4
}

export async function checkTokenSafety(
  address: string,
  rpcTimeoutMs = TOKEN_SAFETY_RPC_TIMEOUT_MS,
): Promise<SafetyReport> {
  const checks: SafetyCheck[] = []

  // 1. Get bytecode
  const bytecode = await getCode(address, rpcTimeoutMs)
  if (bytecode === null) {
    return {
      score: 'caution',
      checks: [{
        name: 'Automated analysis availability',
        status: 'unknown',
        detail: 'LitVM RPC did not respond within the bounded analysis window. No safety conclusion was made.',
      }],
    }
  }
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
    name: 'Mint selector signal',
    status: hasMint ? 'warn' : 'pass',
    detail: hasMint
      ? 'mint() selector bytes were found. Review verified source and permissions; bytecode matching alone does not prove a callable mint path.'
      : 'No common mint() selector bytes were detected; this does not prove the token is non-mintable.',
  })

  // 3. Pause function check
  const hasPause = bytecodeHas(bytecode, SELECTORS.pause) || bytecodeHas(bytecode, SELECTORS.paused)
  checks.push({
    name: 'Pause selector signal',
    status: hasPause ? 'warn' : 'pass',
    detail: hasPause
      ? 'pause() selector bytes were found. Review verified source and permissions before relying on this signal.'
      : 'No common pause() selector bytes were detected; this is not a guarantee.',
  })

  // 4. Owner is EOA check
  const ownerResult = await ethCall(address, '0x' + SELECTORS.owner, rpcTimeoutMs)
  const ownerAddr = decodeAddress(ownerResult)
  if (ownerAddr) {
    const ownerIsContract = await isContract(ownerAddr, rpcTimeoutMs)
    checks.push({
      name: 'Owner code signal',
      status: ownerIsContract === null ? 'unknown' : ownerIsContract ? 'pass' : 'warn',
      detail: ownerIsContract === null
        ? 'Owner code could not be checked within the bounded RPC window.'
        : ownerIsContract
          ? `Contract code exists at owner ${ownerAddr.slice(0, 10)}...; this does not prove multisig or timelock controls.`
          : `No contract code was detected at owner ${ownerAddr.slice(0, 10)}...; review current ownership on-chain.`,
    })
  } else {
    checks.push({
      name: 'Owner code signal',
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

  // 6. Underlying-token dead-address balance. This is not LP-lock evidence.
  const deadAddr = '0x000000000000000000000000000000000000dead'
  const burnCheck = await ethCall(
    address,
    '0x70a08231' + deadAddr.slice(2).padStart(64, '0'),
    rpcTimeoutMs,
  )
  let liquidityCheck: SafetyCheck
  let hasDeadAddressBalance = false
  try {
    hasDeadAddressBalance = Boolean(burnCheck && burnCheck !== '0x' && BigInt(burnCheck) > 0n)
  } catch {
    hasDeadAddressBalance = false
  }
  if (hasDeadAddressBalance) {
    liquidityCheck = {
      name: 'Dead-address token balance',
      status: 'unknown',
      detail: 'Underlying tokens were found at a dead address. This does not prove DEX LP tokens are locked.',
    }
  } else {
    liquidityCheck = {
      name: 'Dead-address token balance',
      status: 'unknown',
      detail: 'No underlying-token dead-address balance was detected. LP lock status was not assessed.',
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
