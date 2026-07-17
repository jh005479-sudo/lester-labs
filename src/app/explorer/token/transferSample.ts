export interface TransferSampleLog {
  topics: string[]
  data: string
}

export interface RecipientSampleEntry {
  address: string
  value: bigint
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function aggregateInboundTransferSample(logs: readonly TransferSampleLog[], limit = 10) {
  const received = new Map<string, bigint>()

  for (const log of logs) {
    if (log.topics.length < 3 || !/^0x[0-9a-fA-F]+$/.test(log.data)) continue
    const to = `0x${log.topics[2].slice(-40)}`.toLowerCase()
    if (to === ZERO_ADDRESS) continue

    try {
      const value = BigInt(log.data)
      received.set(to, (received.get(to) ?? 0n) + value)
    } catch {
      // Ignore malformed third-party log data.
    }
  }

  const entries = Array.from(received, ([address, value]) => ({ address, value }))
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
  const totalValue = entries.reduce((total, entry) => total + entry.value, 0n)

  return {
    entries: entries.slice(0, Math.max(0, Math.floor(limit))),
    recipientCount: entries.length,
    totalValue,
  }
}
