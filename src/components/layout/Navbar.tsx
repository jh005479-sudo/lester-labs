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

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: isHome
          ? 'rgba(13, 10, 36, 0.85)'
          : 'rgba(13, 10, 36, 0.95)',
        backdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid rgba(107, 79, 255, 0.08)',
      }}
    >
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
