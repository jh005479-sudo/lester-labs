'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState } from 'react'
import { ChevronDown, Menu, Wallet, X } from 'lucide-react'

const dappLinks = [
  { href: '/launch',     label: 'Minter' },
  { href: '/locker',     label: 'Locker' },
  { href: '/vesting',    label: 'Vesting' },
  { href: '/airdrop',    label: 'Airdrop' },
  { href: '/swap',       label: 'Swap' },
  { href: '/pool',       label: 'Pool' },
  { href: '/governance', label: 'Governance' },
  { href: '/ledger',     label: 'The Ledger' },
  { href: '/launchpad',  label: 'Launchpad' },
]

const navLinks = [
  { href: '/explorer',   label: 'Explorer' },
  { href: '/analytics',  label: 'Analytics' },
  { href: '/docs',       label: 'Docs' },
  { href: '/tutorials', label: 'Tutorials' },
  { href: '/portfolio',  label: 'Portfolio' },
]

const MOBILE_MENU_HEIGHT = 'calc(100dvh - var(--mobile-header-stack))'

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dappsOpen, setDappsOpen] = useState(false)

  return (
    <nav
      className="fixed left-0 right-0 z-[70]"
      style={{
        top: 'calc(var(--ltc-banner-height) + var(--safe-top))',
        background: isHome ? 'rgba(8, 6, 14, 0.82)' : 'rgba(8, 6, 14, 0.9)',
        backdropFilter: 'blur(22px) saturate(165%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 10px 34px rgba(3,2,10,0.35)',
        transition: 'all 0.35s ease',
      }}
    >
      <div className="mx-auto flex h-12 md:h-14 max-w-[1560px] items-center justify-between px-4 sm:px-8 lg:px-10">
        <Link href="/" className="transition-opacity duration-300 hover:opacity-70" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--foreground)', letterSpacing: '0.15em' }}>
            Lester<span style={{ color: 'var(--accent)' }}>Labs</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <div className="relative">
            <button
              onClick={() => setDappsOpen(!dappsOpen)}
              className="relative flex items-center gap-1 text-[12px] tracking-wide transition-all duration-300"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                color: dappLinks.some(({ href }) => pathname === href || pathname.startsWith(href + '/'))
                  ? 'var(--foreground)'
                  : 'rgba(255,255,255,0.62)',
                letterSpacing: '0.035em',
              }}
            >
              dApps
              <ChevronDown size={14} className={`transition-transform ${dappsOpen ? 'rotate-180' : ''}`} />
              {dappLinks.some(({ href }) => pathname === href || pathname.startsWith(href + '/')) && (
                <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: 'var(--accent)', opacity: 0.6 }} />
              )}
            </button>

            {dappsOpen && (
              <div
                className="absolute left-0 top-8 min-w-[180px] rounded-xl border border-white/10 p-2"
                style={{ background: 'rgba(12, 10, 18, 0.96)', backdropFilter: 'blur(14px)' }}
              >
                {dappLinks.map(({ href, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDappsOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm transition-colors"
                      style={{
                        color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                      }}
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

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
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted
              const connected = ready && account && chain

              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="px-4 py-2 rounded-[14px] text-[14px] font-semibold"
                    style={{
                      color: '#f6f4ff',
                      background: 'linear-gradient(135deg, #6B4FFF 0%, #5B3FF0 100%)',
                      boxShadow: '0 8px 24px rgba(75, 49, 220, 0.35)',
                      border: 'none',
                    }}
                  >
                    Connect Wallet
                  </button>
                )
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-4 py-2 rounded-[14px] text-[14px] font-semibold inline-flex items-center gap-2"
                    style={{
                      color: '#f6f4ff',
                      background: 'rgba(74, 49, 220, 0.22)',
                      border: '1px solid rgba(167, 137, 255, 0.46)',
                      boxShadow: '0 8px 22px rgba(45, 26, 120, 0.35)',
                    }}
                  >
                    {chain?.name}
                    <ChevronDown size={16} />
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="h-[42px] min-w-[64px] px-3 rounded-[14px] inline-flex items-center justify-center"
                    style={{
                      background: 'rgba(74, 49, 220, 0.22)',
                      border: '1px solid rgba(167, 137, 255, 0.46)',
                      boxShadow: '0 8px 22px rgba(45, 26, 120, 0.35)',
                      outline: 'none',
                    }}
                  >
                    {chain?.hasIcon && chain.iconUrl ? (
                      <img
                        src={chain.iconUrl}
                        alt={chain.name ?? 'Chain'}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <Wallet size={16} color="#f6f4ff" />
                    )}
                  </button>
                </div>
              )
            }}
          </ConnectButton.Custom>
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
          className="md:hidden absolute left-0 right-0 flex flex-col gap-1 overflow-y-auto px-5"
          style={{
            top: '100%',
            height: MOBILE_MENU_HEIGHT,
            paddingTop: 16,
            paddingBottom: 'calc(24px + var(--safe-bottom))',
            background: 'rgba(8, 6, 14, 0.97)',
            backdropFilter: 'blur(40px)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <p
              className="mb-2 text-xs uppercase tracking-[0.12em]"
              style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-body)' }}
            >
              dApps
            </p>
            <div className="flex flex-col gap-1">
              {dappLinks.map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="py-2 text-lg font-light tracking-wide transition-colors duration-300"
                    style={{
                      color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                      fontFamily: 'var(--font-heading)',
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>

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
