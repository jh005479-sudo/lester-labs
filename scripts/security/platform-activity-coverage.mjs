export const ALLOWED_PLATFORM_ACTIVITY_COVERAGE_STATUSES = Object.freeze([
  'live',
  'bounded',
  'historical-baseline',
  // Retained only for the currently served legacy rollout response. The
  // remediated application emits historical-baseline instead.
  'audited-baseline',
  'fallback',
])

const ALLOWED_STATUS_SET = new Set(ALLOWED_PLATFORM_ACTIVITY_COVERAGE_STATUSES)
const METRIC_NAMES = Object.freeze([
  'tokensMinted',
  'walletsAirdropped',
  'presalesCreated',
  'swapsCompleted',
  'onChainMessages',
])

export function requirePlatformActivityApiCoverage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Production API coverage is missing or malformed.')
  }

  const coverage = {}
  for (const name of METRIC_NAMES) {
    const entry = value[name]
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.status !== 'string' ||
      !ALLOWED_STATUS_SET.has(entry.status) ||
      typeof entry.note !== 'string' ||
      entry.note.length === 0 ||
      entry.note.length > 500
    ) throw new Error(`Production API coverage is invalid for ${name}.`)

    coverage[name] = { status: entry.status, note: entry.note }
  }
  return coverage
}
