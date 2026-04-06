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

export function RecipientTable({ recipients, tokenSymbol = 'tokens' }: RecipientTableProps) {
  if (recipients.length === 0) return null

  const preview = recipients.slice(0, PREVIEW_LIMIT)
  const overflow = recipients.length - PREVIEW_LIMIT

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-2 text-left text-xs font-medium text-white/40 w-10">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-white/40">Address</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-white/40 whitespace-nowrap">
                Amount ({tokenSymbol})
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-white/40 w-16">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => {
              const valid = isAddress(row.address)
              const amountNum = parseFloat(row.amount)
              const amountOk = !isNaN(amountNum) && amountNum > 0

              return (
                <tr
                  key={i}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    !valid || !amountOk ? 'bg-red-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-2 text-white/30 text-xs">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-xs break-all ${
                        valid ? 'text-white/80' : 'text-red-400'
                      }`}
                    >
                      {row.address || <span className="italic text-white/30">empty</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-xs ${amountOk ? 'text-white/80' : 'text-red-400'}`}>
                      {row.amount || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {!valid || !amountOk ? (
                      <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400">
                        Invalid
                      </span>
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
