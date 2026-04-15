'use client'

import { isAddress } from 'viem'

export interface Recipient {
  address: string
  amount: string
}

interface RecipientTableProps {
  recipients: Recipient[]
  tokenSymbol?: string
}

const PREVIEW_LIMIT = 10
const DECIMAL_AMOUNT_PATTERN = /^-?\d+(\.\d+)?$/

interface RecipientValidation {
  addressError?: string
  amountError?: string
}

export function getRecipientValidation(recipient: Recipient): RecipientValidation {
  const address = recipient.address.trim()
  const amount = recipient.amount.trim()

  let addressError: string | undefined
  if (!address) {
    addressError = 'Address is required'
  } else if (!isAddress(address, { strict: false })) {
    addressError = 'Malformed address'
  } else if (!isAddress(address)) {
    addressError = 'Invalid checksum'
  }

  let amountError: string | undefined
  if (!amount) {
    amountError = 'Amount is required'
  } else if (!DECIMAL_AMOUNT_PATTERN.test(amount)) {
    amountError = 'Invalid amount format'
  } else if (Number(amount) <= 0) {
    amountError = 'Amount must be greater than 0'
  }

  return { addressError, amountError }
}

export function isRecipientValid(recipient: Recipient): boolean {
  const { addressError, amountError } = getRecipientValidation(recipient)
  return !addressError && !amountError
}

export function RecipientTable({ recipients, tokenSymbol = 'tokens' }: RecipientTableProps) {
  if (recipients.length === 0) return null

  const preview = recipients.slice(0, PREVIEW_LIMIT)
  const overflow = recipients.length - PREVIEW_LIMIT

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-2 text-left text-xs font-medium text-white/40 w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-white/40">Address</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-white/40 whitespace-nowrap">
                Amount ({tokenSymbol})
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-white/40 w-52">Validation</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => {
              const address = row.address.trim()
              const amount = row.amount.trim()
              const { addressError, amountError } = getRecipientValidation(row)
              const errors = [addressError, amountError].filter(Boolean)
              const valid = errors.length === 0

              return (
                <tr
                  key={i}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    !valid ? 'bg-red-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-2 text-white/30 text-xs">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-xs break-all ${
                        addressError ? 'text-red-400' : 'text-white/80'
                      }`}
                    >
                      {address || <span className="italic text-white/30">empty</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-xs ${amountError ? 'text-red-400' : 'text-white/80'}`}>
                      {amount || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {!valid ? (
                      <div className="space-y-1">
                        {errors.map((error) => (
                          <p key={error} className="text-[11px] leading-4 text-red-400">
                            {error}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {overflow > 0 && (
        <p className="text-xs text-white/40 text-center">
          + {overflow} more {overflow === 1 ? 'address' : 'addresses'} not shown
        </p>
      )}
    </div>
  )
}
