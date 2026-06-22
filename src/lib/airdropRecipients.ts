export interface ParsedRecipient {
  address: string
  amount: string
}

function normalizeRecipient(address: string, amount: string): ParsedRecipient {
  return {
    address: address.trim().toLowerCase(),
    amount: amount.trim(),
  }
}

export function parseManualRecipients(text: string): ParsedRecipient[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^,\s]+)(?:[\s,]+(.+))?$/)
      return normalizeRecipient(match?.[1] ?? '', match?.[2] ?? '')
    })
}

export function parseCSVRecipients(text: string): ParsedRecipient[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const start = lines[0] && !lines[0].toLowerCase().startsWith('0x') ? 1 : 0

  return lines.slice(start).map((line) => {
    const [address = '', amount = ''] = line.split(',').map((value) => value.trim())
    return normalizeRecipient(address, amount)
  })
}
