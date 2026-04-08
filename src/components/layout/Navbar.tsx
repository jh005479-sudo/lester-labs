'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/launch',     label: 'Launch' },
  { href: '/locker',     label: 'Locker' },
  { href: '/vesting',    label: 'Vesting' },
  { href: '/airdrop',    label: 'Airdrop' },
  { href: '/governance', label: 'Governance' },
  { href: '/launchpad',  label: 'Launchpad' },
  { href: '/explorer',   label: 'Explorer' },
  { href: '/explorer/tokens', label: 'Tokens' },
  { href: '/explorer/health', label: 'Health' },
  { href: '/docs',       label: 'Docs' },
]

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      className="fixed top-[44px] left-0 right-0 z-[70]"
      style={{
        background: isHome ? 'transparent' : 'rgba(8, 6, 14, 0.6)',
        backdropFilter: isHome ? 'none' : 'blur(24px) saturate(180%)',
        borderBottom: isHome ? 'none' : '1px solid rgba(255,255,255,0.04)',
        transition: 'all 0.5s ease',
      }}
    >
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-8 lg:px-10">
        <Link href="/" className="transition-opacity duration-300 hover:opacity-70" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)', letterSpacing: '0.15em' }}>
            Lester<span style={{ color: 'var(--accent)' }}>Labs</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="relative text-[13px] tracking-wide transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                  letterSpacing: '0.04em',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--foreground-dim)' }}
              >
                {label}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                )}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
          <button
            className="md:hidden transition-colors duration-300 p-2 -mr-2"
            style={{ color: 'var(--foreground-dim)' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-[108px] flex flex-col px-5 pt-5 gap-1 overflow-y-auto"
          style={{ background: 'rgba(8, 6, 14, 0.97)', backdropFilter: 'blur(40px)' }}
        >
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-xl font-light tracking-wide transition-colors duration-300"
                style={{
                  color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
