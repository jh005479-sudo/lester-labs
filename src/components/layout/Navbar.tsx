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
  { href: '/docs',       label: 'Docs' },
]

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      className="fixed top-[32px] left-0 right-0 z-[70]"
      style={{
        background: isHome ? 'rgba(8, 6, 14, 0.82)' : 'rgba(8, 6, 14, 0.9)',
        backdropFilter: 'blur(22px) saturate(165%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 10px 34px rgba(3,2,10,0.35)',
        transition: 'all 0.35s ease',
      }}
    >
      <div className="mx-auto flex h-12 sm:h-14 max-w-[1560px] items-center justify-between px-4 sm:px-8 lg:px-10">
        <Link href="/" className="transition-opacity duration-300 hover:opacity-70" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)', letterSpacing: '0.15em' }}>
            Lester<span style={{ color: 'var(--accent)' }}>Labs</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="relative text-[12px] tracking-wide transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  color: isActive ? 'var(--foreground)' : 'rgba(255,255,255,0.62)',
                  letterSpacing: '0.035em',
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
          className="md:hidden fixed inset-0 top-[84px] flex flex-col px-5 pt-5 gap-1 overflow-y-auto"
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


