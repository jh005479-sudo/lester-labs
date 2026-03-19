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
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: isHome ? 'transparent' : 'rgba(8, 6, 14, 0.6)',
        backdropFilter: isHome ? 'none' : 'blur(24px) saturate(180%)',
        borderBottom: isHome ? 'none' : '1px solid rgba(255,255,255,0.04)',
        transition: 'all 0.5s ease',
      }}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
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
            className="md:hidden transition-colors duration-300"
            style={{ color: 'var(--foreground-dim)' }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-20 flex flex-col px-8 pt-8 gap-2"
          style={{ background: 'rgba(8, 6, 14, 0.97)', backdropFilter: 'blur(40px)' }}
        >
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="py-4 text-2xl font-light tracking-wide transition-colors duration-300"
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
