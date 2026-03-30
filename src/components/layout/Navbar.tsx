'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/launch', label: 'Launch' },
  { href: '/locker', label: 'Locker' },
  { href: '/vesting', label: 'Vesting' },
  { href: '/airdrop', label: 'Airdrop' },
  { href: '/governance', label: 'Governance' },
  { href: '/launchpad', label: 'Launchpad' },
  { href: '/explorer', label: 'Explorer' },
  { href: '/docs', label: 'Docs' },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold text-white hover:opacity-80 transition-opacity"
          >
            <span>🐾</span>
            <span>Lester-Labs</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right side: Wallet + Mobile hamburger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
            </div>

            {/* Mobile hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu slide-out panel */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 w-72 bg-[#0a0a0a] border-l border-white/10 transform transition-transform duration-200 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Nav links */}
          <div className="flex-1 overflow-y-auto py-4 px-4">
            <div className="space-y-1">
              {navLinks.map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Mobile wallet connect at bottom */}
          <div className="border-t border-white/10 p-4 sm:hidden">
            <div className="flex justify-center">
              <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
