export interface PoolHealthInput {
  reserve0: bigint
  reserve1: bigint
  token0Decimals: number
  token1Decimals: number
  token0Name: string
  token1Name: string
  token0Symbol: string
  token1Symbol: string
  ageHours?: number
  hasRecentSync?: boolean
}

export interface PoolHealth {
  score: number
  label: 'Strong' | 'Healthy' | 'Thin'
  reasons: string[]
}

function amount(value: bigint, decimals: number) {
  return Number(value) / 10 ** decimals
}

function hasUsefulMetadata(name: string, symbol: string) {
  const text = `${name} ${symbol}`.toLowerCase()
  return !/(^|\s)(token|unknown|\.\.\.|0x[a-f0-9]{3,})($|\s)/.test(text)
}

export function getPoolHealth(input: PoolHealthInput): PoolHealth {
  const reserve0 = amount(input.reserve0, input.token0Decimals)
  const reserve1 = amount(input.reserve1, input.token1Decimals)
  const depth = Math.min(reserve0, reserve1)
  const reasons: string[] = []
  let score = 0

  if (depth >= 100) {
    score += 50
    reasons.push('deep paired reserves')
  } else if (depth >= 10) {
    score += 30
    reasons.push('usable reserve depth')
  } else if (depth > 0) {
    score += 15
    reasons.push('thin reserve depth')
  } else {
    reasons.push('no visible reserves')
  }

  const metadataComplete = hasUsefulMetadata(input.token0Name, input.token0Symbol)
    && hasUsefulMetadata(input.token1Name, input.token1Symbol)
  if (metadataComplete) {
    score += 25
    reasons.push('metadata complete')
  } else {
    reasons.push('metadata needs review')
  }

  if ((input.ageHours ?? 0) >= 24) {
    score += 15
    reasons.push('older than 24h')
  }

  if (input.hasRecentSync) {
    score += 15
    reasons.push('recent reserve activity')
  }

  const bounded = Math.max(0, Math.min(100, score))
  return {
    score: bounded,
    label: bounded >= 80 ? 'Strong' : bounded >= 45 ? 'Healthy' : 'Thin',
    reasons,
  }
}
