'use client'

import Link from 'next/link'
import { Coins, Lock, Clock, Send, Users, Rocket } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'

/* ─── Data ──────────────────────────────────────────────────────────── */

const utilities = [
  {
    href: '/launch',
    icon: Coins,
    name: 'Token Factory',
    description: 'Deploy a standard ERC-20 token in 3 steps. No coding required.',
    fee: '0.05 zkLTC/deploy',
  },
  {
    href: '/locker',
    icon: Lock,
    name: 'Liquidity Locker',
    description: 'Lock LP tokens and generate a shareable lock certificate for your community.',
    fee: '0.03 zkLTC/lock',
  },
  {
    href: '/vesting',
    icon: Clock,
    name: 'Token Vesting',
    description: 'Set linear or cliff vesting schedules for team and investor allocations.',
    fee: '0.03 zkLTC/schedule',
  },
  {
    href: '/airdrop',
    icon: Send,
    name: 'Airdrop Tool',
    description: 'Send tokens to hundreds of wallets in one transaction. CSV import supported.',
    fee: '0.01 zkLTC/batch',
  },
  {
    href: '/governance',
    icon: Users,
    name: 'Governance',
    description: 'Create proposals and let your community vote. No gas required.',
    fee: 'Free',
  },
  {
    href: '/launchpad',
    icon: Rocket,
    name: 'Launchpad',
    description: 'Community presales with automatic SparkDex LP creation and locking. Self-service, permissionless.',
    fee: '0.03 zkLTC + 2%',
  },
]

const reasons = [
  {
    emoji: '🔒',
    title: 'Battle-Tested Contracts',
    body: 'Forked 1:1 from OpenZeppelin, Unicrypt, Disperse, and Snapshot. No custom contract logic means no new attack surface.',
  },
  {
    emoji: '⚡',
    title: 'Built for LitVM Day One',
    body: 'The first DeFi utility suite on LitVM. Get your project running from the moment mainnet launches.',
  },
  {
    emoji: '🐾',
    title: 'Backed by the Community',
    body: 'Built by the team behind QuickSwap, SparkDex, and Polygon. Grant-supported by the LitVM Foundation.',
  },
]

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />

      <main>
        {/* ── Section 1: Hero ──────────────────────────────────────────── */}
        <section className="relative flex flex-col items-center justify-center px-4 pb-24 pt-40 text-center sm:px-6 lg:px-8">
          {/* Subtle radial glow behind headline */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              background:
                'radial-gradient(ellipse 60% 40% at 50% 30%, var(--accent-muted) 0%, transparent 70%)',
            }}
          />

          {/* Network badge */}
          <div className="relative mb-10">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{
                borderColor: 'rgba(245,158,11,0.35)',
                background: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live on LitVM Testnet — Coming Soon
            </span>
          </div>

          {/* Headline */}
          <h1
            className="relative mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            style={{ lineHeight: 1.1 }}
          >
            Every Tool a LitVM Project Needs{' '}
            <span style={{ color: 'var(--accent)' }}>— In One Place</span>
          </h1>

          {/* Subheadline */}
          <p
            className="relative mx-auto mt-6 max-w-2xl text-lg leading-relaxed"
            style={{ color: 'rgba(237,237,237,0.55)' }}
          >
            The DeFi utility suite for LitVM — Token Factory, Locker, Vesting, Airdrop,
            Governance &amp; Launchpad. Testnet live on Arbitrum Sepolia. Mainnet launches with LitVM.
          </p>

          {/* CTAs */}
          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/launch"
              className="inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Launch a Token →
            </Link>
            <a
              href="#utilities"
              className="inline-flex items-center rounded-lg border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
              style={{
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(237,237,237,0.8)',
              }}
            >
              Explore Tools
            </a>
          </div>

          {/* Tagline */}
          <p
            className="relative mt-6 text-xs"
            style={{ color: 'rgba(237,237,237,0.3)' }}
          >
            Powered by battle-tested contracts. Built for LitVM.
          </p>
        </section>

        {/* ── Section 2: Utility Cards ─────────────────────────────────── */}
        <section
          id="utilities"
          className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:px-8"
        >
          <h2
            className="mb-3 text-center text-2xl font-bold tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Everything your project needs
          </h2>
          <p className="mb-12 text-center text-sm" style={{ color: 'rgba(237,237,237,0.4)' }}>
            Six utilities. One dashboard. Zero guesswork.
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {utilities.map(({ href, icon: Icon, name, description, fee }) => (
              <div
                key={href}
                className="group relative flex flex-col rounded-xl p-6 transition-colors"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(99,102,241,0.4)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(255,255,255,0.07)'
                }}
              >
                {/* Icon + status badge row */}
                <div className="mb-5 flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-lg"
                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                  >
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      background: 'rgba(255,184,0,0.1)',
                      color: '#FFB800',
                      border: '1px solid rgba(255,184,0,0.25)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FFB800' }} />
                    Testnet Preview
                  </span>
                </div>

                {/* Name */}
                <h3 className="mb-1.5 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                  {name}
                </h3>

                {/* Description */}
                <p
                  className="mb-4 flex-1 text-sm leading-relaxed"
                  style={{ color: 'rgba(237,237,237,0.5)' }}
                >
                  {description}
                </p>

                {/* Fee + Open row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'rgba(237,237,237,0.3)' }}>
                    Fee: {fee}
                  </span>
                  <Link
                    href={href}
                    className="text-sm font-medium transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 3: Why Lester-Labs ───────────────────────────────── */}
        <section
          className="border-y px-4 py-20 sm:px-6 lg:px-8"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-12 text-center text-2xl font-bold tracking-tight"
              style={{ color: 'var(--foreground)' }}
            >
              Why Lester-Labs?
            </h2>
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
              {reasons.map(({ emoji, title, body }) => (
                <div key={title} className="text-center sm:text-left">
                  <div className="mb-4 text-3xl">{emoji}</div>
                  <h3 className="mb-2 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(237,237,237,0.45)' }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: Footer ────────────────────────────────────────── */}
        <footer className="px-4 py-12 sm:px-6 lg:px-8" style={{ background: 'var(--background)' }}>
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              {/* Left */}
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  🐾 Lester-Labs
                </p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(237,237,237,0.3)' }}>
                  © 2026 Lester-Labs. Built on LitVM.
                </p>
              </div>

              {/* Right links */}
              <div className="flex items-center gap-6">
                <a
                  href="/docs"
                  className="text-xs transition-colors hover:opacity-80"
                  style={{ color: 'rgba(237,237,237,0.4)' }}
                >
                  Docs
                </a>
                <span
                  className="text-xs"
                  style={{ color: 'rgba(107,107,138,0.5)' }}
                >
                  GitHub (soon)
                </span>
                <a
                  href="https://twitter.com/LesterLabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs transition-colors hover:opacity-80"
                  style={{ color: 'rgba(237,237,237,0.4)' }}
                >
                  Twitter/X
                </a>
              </div>
            </div>

            {/* Disclaimer */}
            <p
              className="mt-8 border-t pt-6 text-xs"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                color: 'rgba(237,237,237,0.2)',
              }}
            >
              Use at your own risk. Smart contracts are unaudited on testnet. Not financial advice.
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
