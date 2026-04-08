'use client'

import { useEffect, useState } from 'react'

interface BannerData {
  price: number | null
  change24h: number | null
  txFee: number | null
  blockHeight: number | null
  hashrate: number | null
}

export function LTCBanner() {
  const [data, setData] = useState<BannerData>({
    price: null,
    change24h: null,
    txFee: null,
    blockHeight: null,
    hashrate: null,
  })

  useEffect(() => {
    async function fetchData() {
      const [priceRes, chainRes] = await Promise.allSettled([
        fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd&include_24hr_change=true',
        ),
        fetch('https://api.blockcypher.com/v1/ltc/main'),
      ])

      const next: BannerData = {
        price: null,
        change24h: null,
        txFee: null,
        blockHeight: null,
        hashrate: null,
      }

      if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
        const json = await priceRes.value.json()
        next.price = json?.litecoin?.usd ?? null
        next.change24h = json?.litecoin?.usd_24h_change ?? null
      }

      if (chainRes.status === 'fulfilled' && chainRes.value.ok) {
        const json = await chainRes.value.json()
        next.blockHeight = json?.height ?? null
        next.txFee = json?.medium_fee_per_kb != null ? Math.round(json.medium_fee_per_kb / 1000) : null
        next.hashrate =
          json?.hash_rate != null ? Math.round(json.hash_rate / 1e12) : null
      }

      setData(next)
    }

    fetchData()
    const id = setInterval(fetchData, 60_000)
    return () => clearInterval(id)
  }, [])

  const changeColor =
    data.change24h != null
      ? data.change24h >= 0
        ? 'var(--success)'
        : 'var(--error)'
      : undefined

  const arrow = data.change24h != null ? (data.change24h >= 0 ? '\u25B2' : '\u25BC') : ''

  return (
    <div
      id="ltc-banner"
      className="fixed top-0 left-0 right-0 z-[80] flex w-full items-center justify-between gap-4 overflow-x-auto px-4 sm:px-6"
      style={{
        background: 'var(--surface-2)',
        height: 44,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: 12,
      }}
    >
      {/* Left metrics */}
      <div className="flex items-center gap-5 whitespace-nowrap">
        {/* Live dot */}
        <span
          className="h-2 w-2 shrink-0 rounded-full animate-pulse"
          style={{ background: 'var(--success)' }}
        />

        {/* Price */}
        <span className="flex items-center gap-1.5">
          <span style={{ color: 'var(--accent)' }}>LTC/USD</span>
          <span style={{ color: 'var(--foreground)' }}>
            ${data.price != null ? data.price.toFixed(2) : '--'}
          </span>
          {data.change24h != null && (
            <span style={{ color: changeColor }}>
              {arrow} {Math.abs(data.change24h).toFixed(2)}%
            </span>
          )}
        </span>

        {/* Tx fee */}
        <span className="flex items-center gap-1.5">
          <span style={{ color: 'rgba(237,237,237,0.5)' }}>LTC Tx Fee</span>
          <span style={{ color: 'var(--foreground)' }}>
            {data.txFee != null ? data.txFee : '--'} sat/byte
          </span>
        </span>

        {/* Block */}
        <span className="flex items-center gap-1.5">
          <span style={{ color: 'rgba(237,237,237,0.5)' }}>LTC Block</span>
          <span style={{ color: 'var(--foreground)' }}>
            #{data.blockHeight != null ? data.blockHeight.toLocaleString() : '--'}
          </span>
        </span>

        {/* Hashrate */}
        <span className="flex items-center gap-1.5">
          <span style={{ color: 'rgba(237,237,237,0.5)' }}>Hashrate</span>
          <span style={{ color: 'var(--foreground)' }}>
            {data.hashrate != null ? data.hashrate.toLocaleString() : '--'} TH/s
          </span>
        </span>
      </div>

      {/* Right note */}
      <span
        className="hidden shrink-0 whitespace-nowrap lg:block"
        style={{ color: 'rgba(237,237,237,0.25)', fontSize: 11 }}
      >
        Data via Bitaps · zkLTC data coming at LitVM mainnet
      </span>
    </div>
  )
}
