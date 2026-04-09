'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'

const navLinks = [
  { href: '/launch', label: 'Launch' },
  { href: '/locker', label: 'Locker' },
  { href: '/vesting', label: 'Vesting' },
  { href: '/airdrop', label: 'Airdrop' },
  { href: '/governance', label: 'Governance' },
  { href: '/launchpad', label: 'Launchpad' },
]

const marketStrip = [
  'LTC/USD $54.86',
  '▲ 0.99%',
  'LTC Tx Fee 10 sat/byte',
  'LTC Block #3,087,092',
  'Hashrate — TH/s',
]

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: isHome
          ? 'rgba(13, 10, 36, 0.88)'
          : 'rgba(13, 10, 36, 0.96)',
        backdropFilter: 'blur(18px) saturate(170%)',
        borderBottom: '1px solid rgba(107, 79, 255, 0.14)',
        boxShadow: '0 10px 28px rgba(4,3,12,0.35)',
      }}
    >
      <div
        className="hidden md:block"
        style={{
          height: '28px',
          borderBottom: '1px solid rgba(107, 79, 255, 0.12)',
          background: 'linear-gradient(90deg, rgba(73,44,225,0.14) 0%, rgba(13,10,36,0.88) 28%, rgba(13,10,36,0.88) 72%, rgba(73,44,225,0.08) 100%)',
        }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 text-[11px] font-medium tracking-[0.04em] text-white/70">
            {marketStrip.map((item, i) => (
              <span key={item} className="flex items-center gap-4">
                {i > 0 && <span className="text-white/20">|</span>}
                <span style={{ color: item.includes('▲') ? '#22c55e' : 'rgba(255,255,255,0.7)' }}>{item}</span>
              </span>
            ))}
          </div>
          <span className="text-[10px] tracking-[0.06em] text-white/35">Data via Bitaps · zkLTC data coming at LitVM mainnet</span>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <span style={{ color: '#6B4FFF', fontSize: '16px' }}>◆</span>
          <span className="text-lg font-bold tracking-tight text-white">
            LESTER<span style={{ color: '#492CE1' }}>LABS</span>
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 400,
                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'rgba(73, 44, 225, 0.15)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#FFFFFF'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Wallet connect */}
        <div className="flex items-center gap-3">
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="avatar"
          />
        </div>
      </div>

      {/* Mobile nav */}
      <div
        className="md:hidden px-4 py-2 flex gap-1 overflow-x-auto"
        style={{ borderTop: '1px solid rgba(107, 79, 255, 0.06)' }}
      >
        {navLinks.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(73, 44, 225, 0.15)' : 'transparent',
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
