export interface ParsedRecipient {
  address: string
  amount: string
}

export interface RecipientPage<T extends ParsedRecipient = ParsedRecipient> {
  rows: T[]
  page: number
  pageCount: number
  startIndex: number
  endIndex: number
  totalRows: number
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

export function isValidAirdropAmount(amount: string, maxDecimals?: number): boolean {
  const normalized = amount.trim()
  if (!/^\d+(?:\.\d+)?$/.test(normalized) || !/[1-9]/.test(normalized)) return false
  if (maxDecimals === undefined) return true

  const fraction = normalized.split('.')[1] ?? ''
  return fraction.length <= maxDecimals
}

export function isValidAirdropAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim())
}

export function isValidAirdropRecipient(recipient: ParsedRecipient, maxDecimals?: number): boolean {
  return isValidAirdropAddress(recipient.address)
    && isValidAirdropAmount(recipient.amount, maxDecimals)
}

export function buildValidatedRecipientSnapshot<T extends ParsedRecipient>(
  recipients: T[],
  maxDecimals?: number,
): T[] {
  return recipients
    .filter((recipient) => isValidAirdropRecipient(recipient, maxDecimals))
    .map((recipient) => ({
      ...recipient,
      address: recipient.address.trim(),
      amount: recipient.amount.trim(),
    }))
}

export function getRecipientPage<T extends ParsedRecipient>(
  recipients: T[],
  requestedPage: number,
  pageSize: number,
): RecipientPage<T> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Recipient page size must be a positive integer')
  }

  const pageCount = Math.max(1, Math.ceil(recipients.length / pageSize))
  const page = Math.min(Math.max(Math.trunc(requestedPage), 0), pageCount - 1)
  const startIndex = page * pageSize
  const rows = recipients.slice(startIndex, startIndex + pageSize)

  return {
    rows,
    page,
    pageCount,
    startIndex,
    endIndex: startIndex + rows.length,
    totalRows: recipients.length,
  }
}
