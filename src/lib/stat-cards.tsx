'use client'

import React from 'react'

export interface StatCardProps {
  blockHeight: number
  txCount24h: number
  activeAddresses24h: number
  avgBlockTime: number
  gasPrice: string
  networkName: string
  timestamp: string
}

export function StatCardSVG(props: StatCardProps) {
  const fmt = (n: number) => n.toLocaleString()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1200"
      height="630"
      viewBox="0 0 1200 630"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <defs>
        <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="1200" height="630" rx="16" fill="#0a0a0f" />
      {/* Gradient border */}
      <rect x="2" y="2" width="1196" height="626" rx="14" fill="none" stroke="url(#borderGrad)" strokeWidth="2" />

      {/* Header */}
      <text x="60" y="70" fill="white" fontSize="32" fontWeight="800" letterSpacing="2">LITVM</text>
      <text x="190" y="70" fill="rgba(255,255,255,0.35)" fontSize="16" fontWeight="400">via Lester-Labs</text>

      {/* Network badge */}
      <rect x="940" y="40" width="200" height="36" rx="18" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
      <text x="1040" y="63" fill="#8b5cf6" fontSize="14" fontWeight="600" textAnchor="middle">{props.networkName}</text>

      {/* Accent line */}
      <line x1="60" y1="100" x2="1140" y2="100" stroke="url(#accentLine)" strokeWidth="1" />

      {/* Stats grid - 3 rows x 2 cols */}
      {[
        [{ label: 'Block Height', value: fmt(props.blockHeight) }, { label: 'Active Validators', value: '—' }],
        [{ label: '24h Transactions', value: fmt(props.txCount24h) }, { label: '24h Active Addresses', value: fmt(props.activeAddresses24h) }],
        [{ label: 'Avg Block Time', value: `${props.avgBlockTime.toFixed(1)}s` }, { label: 'Gas Price', value: props.gasPrice }],
      ].map((row, ri) =>
        row.map((cell, ci) => {
          const x = ci === 0 ? 100 : 660
          const y = 170 + ri * 130
          return (
            <React.Fragment key={`${ri}-${ci}`}>
              <text x={x} y={y} fill="rgba(255,255,255,0.4)" fontSize="13" fontWeight="500" letterSpacing="1.5">{cell.label}</text>
              <text x={x} y={y + 44} fill="white" fontSize="36" fontWeight="700">{cell.value}</text>
            </React.Fragment>
          )
        })
      )}

      {/* Bottom accent line */}
      <line x1="60" y1="540" x2="1140" y2="540" stroke="url(#accentLine)" strokeWidth="1" />

      {/* Footer */}
      <text x="60" y="580" fill="rgba(255,255,255,0.5)" fontSize="14">litvm.network</text>
      <text x="1140" y="580" fill="rgba(255,255,255,0.3)" fontSize="13" textAnchor="end">{props.timestamp}</text>

      {/* Decorative dots */}
      <circle cx="60" cy="608" r="3" fill="#6366f1" opacity="0.6" />
      <circle cx="74" cy="608" r="3" fill="#8b5cf6" opacity="0.6" />
      <circle cx="88" cy="608" r="3" fill="#3b82f6" opacity="0.6" />
    </svg>
  )
}

/** Render SVG to a canvas and return a Blob (PNG) */
export async function renderStatCardToBlob(props: StatCardProps): Promise<Blob> {
  const svgString = renderToSVGString(props)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}

function renderToSVGString(props: StatCardProps): string {
  const fmt = (n: number) => n.toLocaleString()
  // Build SVG string server-side compatible (no React)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0"/>
      <stop offset="50%" stop-color="#8b5cf6" stop-opacity="1"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="16" fill="#0a0a0f"/>
  <rect x="2" y="2" width="1196" height="626" rx="14" fill="none" stroke="url(#borderGrad)" stroke-width="2"/>
  <text x="60" y="70" fill="white" font-size="32" font-weight="800" letter-spacing="2" font-family="system-ui, sans-serif">LITVM</text>
  <text x="190" y="70" fill="rgba(255,255,255,0.35)" font-size="16" font-weight="400" font-family="system-ui, sans-serif">via Lester-Labs</text>
  <rect x="940" y="40" width="200" height="36" rx="18" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" stroke-width="1"/>
  <text x="1040" y="63" fill="#8b5cf6" font-size="14" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">${props.networkName}</text>
  <line x1="60" y1="100" x2="1140" y2="100" stroke="url(#accentLine)" stroke-width="1"/>
  <text x="100" y="170" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">BLOCK HEIGHT</text>
  <text x="100" y="214" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">${fmt(props.blockHeight)}</text>
  <text x="660" y="170" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">ACTIVE VALIDATORS</text>
  <text x="660" y="214" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">—</text>
  <text x="100" y="300" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">24H TRANSACTIONS</text>
  <text x="100" y="344" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">${fmt(props.txCount24h)}</text>
  <text x="660" y="300" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">24H ACTIVE ADDRESSES</text>
  <text x="660" y="344" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">${fmt(props.activeAddresses24h)}</text>
  <text x="100" y="430" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">AVG BLOCK TIME</text>
  <text x="100" y="474" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">${props.avgBlockTime.toFixed(1)}s</text>
  <text x="660" y="430" fill="rgba(255,255,255,0.4)" font-size="13" font-weight="500" font-family="system-ui, sans-serif">GAS PRICE</text>
  <text x="660" y="474" fill="white" font-size="36" font-weight="700" font-family="system-ui, sans-serif">${props.gasPrice}</text>
  <line x1="60" y1="540" x2="1140" y2="540" stroke="url(#accentLine)" stroke-width="1"/>
  <text x="60" y="580" fill="rgba(255,255,255,0.5)" font-size="14" font-family="system-ui, sans-serif">litvm.network</text>
  <text x="1140" y="580" fill="rgba(255,255,255,0.3)" font-size="13" text-anchor="end" font-family="system-ui, sans-serif">${props.timestamp}</text>
  <circle cx="60" cy="608" r="3" fill="#6366f1" opacity="0.6"/>
  <circle cx="74" cy="608" r="3" fill="#8b5cf6" opacity="0.6"/>
  <circle cx="88" cy="608" r="3" fill="#3b82f6" opacity="0.6"/>
</svg>`
}

/** Token share card props */
export interface TokenCardProps {
  name: string
  symbol: string
  price?: string
  holderCount: number
  launchedAgo: string
}

export function TokenCardSVG(props: TokenCardProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <defs>
        <linearGradient id="tborderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="taccentLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" rx="16" fill="#0a0a0f" />
      <rect x="2" y="2" width="1196" height="626" rx="14" fill="none" stroke="url(#tborderGrad)" strokeWidth="2" />

      {/* Token name */}
      <text x="60" y="100" fill="white" fontSize="48" fontWeight="800">{props.name}</text>
      <text x="60" y="140" fill="rgba(255,255,255,0.4)" fontSize="20" fontWeight="600">{props.symbol}</text>

      {/* Price */}
      {props.price && (
        <>
          <text x="60" y="230" fill="rgba(255,255,255,0.4)" fontSize="14" fontWeight="500">PRICE</text>
          <text x="60" y="274" fill="#22c55e" fontSize="40" fontWeight="700">{props.price}</text>
        </>
      )}

      {/* Holders */}
      <text x="60" y="360" fill="rgba(255,255,255,0.4)" fontSize="14" fontWeight="500">HOLDERS</text>
      <text x="60" y="404" fill="white" fontSize="40" fontWeight="700">{props.holderCount.toLocaleString()}</text>

      {/* Badge */}
      <rect x="60" y="470" width="220" height="40" rx="20" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
      <text x="170" y="495" fill="#8b5cf6" fontSize="14" fontWeight="600" textAnchor="middle">Launched on LitVM</text>

      <text x="300" y="495" fill="rgba(255,255,255,0.4)" fontSize="14">{props.launchedAgo}</text>

      <line x1="60" y1="540" x2="1140" y2="540" stroke="url(#taccentLine)" strokeWidth="1" />
      <text x="60" y="580" fill="rgba(255,255,255,0.5)" fontSize="14">lester-labs-psi.vercel.app</text>
    </svg>
  )
}
