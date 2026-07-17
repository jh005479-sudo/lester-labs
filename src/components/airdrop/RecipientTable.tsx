'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getRecipientPage, isValidAirdropAddress, isValidAirdropAmount } from '@/lib/airdropRecipients'

export interface Recipient {
  address: string
  amount: string
}

interface RecipientTableProps {
  recipients: Recipient[]
  tokenSymbol?: string
  maxDecimals?: number
}

const PAGE_SIZE = 50

export function RecipientTable({ recipients, tokenSymbol = 'tokens', maxDecimals }: RecipientTableProps) {
  const [requestedPage, setRequestedPage] = useState(0)
  const recipientPage = useMemo(
    () => getRecipientPage(recipients, requestedPage, PAGE_SIZE),
    [recipients, requestedPage],
  )

  if (recipients.length === 0) return null

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
            {recipientPage.rows.map((row, i) => {
              const valid = isValidAirdropAddress(row.address)
              const amountOk = isValidAirdropAmount(row.amount, maxDecimals)
              const rowNumber = recipientPage.startIndex + i + 1

              return (
                <tr
                  key={`${rowNumber}:${row.address}:${row.amount}`}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    !valid || !amountOk ? 'bg-red-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-2 text-white/30 text-xs">{rowNumber}</td>
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

      {recipientPage.pageCount > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            Rows {recipientPage.startIndex + 1}-{recipientPage.endIndex} of {recipientPage.totalRows}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRequestedPage(recipientPage.page - 1)}
              disabled={recipientPage.page === 0}
              aria-label="Previous recipient page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-20 text-center text-xs text-white/50">
              Page {recipientPage.page + 1} of {recipientPage.pageCount}
            </span>
            <button
              type="button"
              onClick={() => setRequestedPage(recipientPage.page + 1)}
              disabled={recipientPage.page === recipientPage.pageCount - 1}
              aria-label="Next recipient page"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
