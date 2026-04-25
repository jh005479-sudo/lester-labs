'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ChevronDown, Grid3X3, Menu, Wallet, X } from 'lucide-react'
import { appGroups, isActivePath } from '@/lib/product-flow'

const directLinks = [
  { href: '/ledger', label: 'Ledger' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/tutorials', label: 'Tutorials' },
  { href: '/docs', label: 'Docs' },
]

const MOBILE_MENU_HEIGHT = 'calc(100dvh - var(--mobile-header-stack))'

export function Navbar() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [appsOpen, setAppsOpen] = useState(false)
  const appsRef = useRef<HTMLDivElement>(null)
  const appActive = appGroups.some((group) => group.apps.some(({ href }) => isActivePath(pathname, href)))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (appsRef.current && !appsRef.current.contains(e.target as Node)) setAppsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      <div className="mx-auto flex h-12 max-w-[1560px] items-center justify-between px-4 sm:px-8 md:h-14 lg:px-10">
        <Link prefetch={false} href="/" className="transition-opacity duration-300 hover:opacity-70" style={{ fontFamily: 'var(--font-heading)' }}>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--foreground)', letterSpacing: '0.15em' }}>
            Lester<span style={{ color: 'var(--accent)' }}>Labs</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <div className="relative" ref={appsRef}>
            <button
              onClick={() => setAppsOpen((open) => !open)}
              className="relative flex items-center gap-1.5 text-[12px] tracking-wide transition-all duration-300"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: appActive ? 'var(--foreground)' : 'rgba(255,255,255,0.62)',
                letterSpacing: '0.035em',
              }}
            >
              <Grid3X3 size={13} />
              Apps
              <ChevronDown size={14} className={`transition-transform ${appsOpen ? 'rotate-180' : ''}`} />
              {appActive && (
                <span className="absolute -bottom-1 left-0 right-0 h-px" style={{ background: 'var(--accent)', opacity: 0.6 }} />
              )}
            </button>

            {appsOpen && (
              <div
                className="absolute left-0 top-8 w-[720px] rounded-2xl border border-white/10 p-4"
                style={{
                  background: 'rgba(12, 10, 18, 0.98)',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 26px 80px rgba(0,0,0,0.42)',
                }}
              >
                <div className="grid grid-cols-5 gap-3">
                  {appGroups.map((group) => (
                    <div key={group.intent} className="min-w-0">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: 'rgba(255,255,255,0.36)' }}>
                        {group.intent}
                      </p>
                      <p className="mb-2 min-h-[30px] text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.34)' }}>
                        {group.summary}
                      </p>
                      <div className="flex flex-col gap-1">
                        {group.apps.map((app) => {
                          const Icon = app.icon
                          const isActive = isActivePath(pathname, app.href)

                          return (
                            <Link
                              key={app.href}
                              href={app.href}
                              prefetch={false}
                              onClick={() => setAppsOpen(false)}
                              className="group rounded-xl p-2.5 transition-colors hover:bg-white/[0.045]"
                              style={{
                                color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                                textDecoration: 'none',
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                  style={{
                                    color: app.accent,
                                    background: `${app.accent}18`,
                                    border: `1px solid ${app.accent}40`,
                                  }}
                                >
                                  <Icon size={14} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-semibold leading-none">{app.label}</span>
                                  <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
                                    {app.description}
                                  </span>
                                </span>
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {directLinks.map(({ href, label }) => {
            const isActive = isActivePath(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="relative text-[12px] tracking-wide transition-all duration-300"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  color: isActive ? 'var(--foreground)' : 'rgba(255,255,255,0.62)',
                  letterSpacing: '0.035em',
                }}
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
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain

              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="rounded-[14px] px-4 py-2 text-[14px] font-semibold"
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
                    className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-[14px] font-semibold"
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
                    className="inline-flex h-[42px] min-w-[64px] items-center justify-center rounded-[14px] px-3"
                    style={{
                      background: 'rgba(74, 49, 220, 0.22)',
                      border: '1px solid rgba(167, 137, 255, 0.46)',
                      boxShadow: '0 8px 22px rgba(45, 26, 120, 0.35)',
                      outline: 'none',
                    }}
                  >
                    {chain?.hasIcon && chain.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={chain.iconUrl} alt={chain.name ?? 'Chain'} className="h-6 w-6 rounded-full" />
                    ) : (
                      <Wallet size={16} color="#f6f4ff" />
                    )}
                  </button>
                </div>
              )
            }}
          </ConnectButton.Custom>

          <button
            className="-mr-2 p-2 transition-colors duration-300 md:hidden"
            style={{ color: 'var(--foreground-dim)' }}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="absolute left-0 right-0 flex flex-col gap-5 overflow-y-auto px-5 md:hidden"
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
          {appGroups.map((group) => (
            <div key={group.intent} className="pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="mb-1 text-xs uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-body)' }}>
                {group.intent}
              </p>
              <p className="mb-2 text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>
                {group.summary}
              </p>
              <div className="grid gap-2">
                {group.apps.map((app) => {
                  const Icon = app.icon
                  const isActive = isActivePath(pathname, app.href)
                  return (
                    <Link
                      key={app.href}
                      href={app.href}
                      prefetch={false}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
                      style={{
                        color: isActive ? 'var(--foreground)' : 'var(--foreground-dim)',
                        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                        textDecoration: 'none',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ color: app.accent, background: `${app.accent}18`, border: `1px solid ${app.accent}40` }}
                      >
                        <Icon size={16} />
                      </span>
                      <span>
                        <span className="block text-lg font-light tracking-wide">{app.label}</span>
                        <span className="block text-xs" style={{ color: 'rgba(255,255,255,0.36)' }}>{app.description}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {directLinks.filter(({ href }) => href === '/tutorials').map(({ href, label }) => {
            const isActive = isActivePath(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-xl font-light tracking-wide transition-colors duration-300"
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
      )}
    </nav>
  )
}
