'use client'

import Link from 'next/link'
import { Coins, Lock, Clock, Send, Users, Rocket, BookOpen, Github, MessageCircle, Gift, ArrowRight, ExternalLink } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import ScrollHero from '@/components/home/ScrollHero'

/* ─── Tool Data ──────────────────────────────────────────────────────── */

const utilities = [
  {
    href: '/launch',
    icon: Coins,
    name: 'Token Factory',
    tagline: 'Deploy ERC-20 tokens in 3 steps',
    description: 'No coding required. Configure supply, name, and optional features — then deploy. Your token is live in under a minute.',
    fee: '0.05 zkLTC',
    gradient: 'linear-gradient(135deg, rgba(73,44,225,0.15), rgba(107,79,255,0.05))',
  },
  {
    href: '/locker',
    icon: Lock,
    name: 'Liquidity Locker',
    tagline: 'Lock LP tokens with proof',
    description: 'Lock liquidity and generate a shareable on-chain certificate. Build trust with your community from day one.',
    fee: '0.03 zkLTC',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(73,44,225,0.05))',
  },
  {
    href: '/vesting',
    icon: Clock,
    name: 'Token Vesting',
    tagline: 'Linear & cliff schedules',
    description: 'Set vesting schedules for team and investor allocations. Tokens release automatically — no manual claims needed.',
    fee: '0.03 zkLTC',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(73,44,225,0.05))',
  },
  {
    href: '/airdrop',
    icon: Send,
    name: 'Airdrop Tool',
    tagline: 'Batch send in one transaction',
    description: 'Send tokens to hundreds of wallets at once. CSV import supported. Perfect for community rewards and distributions.',
    fee: '0.01 zkLTC',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(73,44,225,0.05))',
  },
  {
    href: '/governance',
    icon: Users,
    name: 'Governance',
    tagline: 'Gasless community voting',
    description: 'Create proposals and let token holders vote. Snapshot-style governance with no gas costs for voters.',
    fee: 'Free',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(73,44,225,0.05))',
  },
  {
    href: '/launchpad',
    icon: Rocket,
    name: 'Launchpad',
    tagline: 'Permissionless presales',
    description: 'Community presales with automatic SparkDex LP creation and locking. Self-service, no gatekeepers.',
    fee: '0.03 zkLTC + 2%',
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(73,44,225,0.05))',
  },
]

const devCards = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Guides, API reference, and integration walkthroughs for every Lester Labs tool.',
    link: 'https://docs.litvm.com',
    linkLabel: 'Read the Docs',
    external: true,
  },
  {
    icon: Gift,
    title: 'LitVM Grants',
    description: 'Building on LitVM? The Foundation offers grants for teams shipping real infrastructure.',
    link: 'https://litvm.com',
    linkLabel: 'Apply for a Grant',
    external: true,
  },
  {
    icon: Github,
    title: 'Open Source',
    description: 'All contracts are forked 1:1 from battle-tested originals. Verify everything on-chain.',
    link: 'https://github.com',
    linkLabel: 'View on GitHub',
    external: true,
  },
  {
    icon: MessageCircle,
    title: 'Community',
    description: 'Join the builders, degens, and dreamers shipping the LitVM ecosystem together.',
    link: 'https://discord.gg',
    linkLabel: 'Join Discord',
    external: true,
  },
]

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />

      <main>
        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: Scroll-Shatter Hero
            500vh runway → sticky viewport with video → freeze → shatter
        ═══════════════════════════════════════════════════════════════ */}
        <ScrollHero />


        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: Tool Showcase
            Osmosis-style card grid — 6 utilities with hover effects
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-28 sm:px-6 lg:px-8">
          {/* Ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(73,44,225,0.08) 0%, transparent 70%)',
            }}
          />

          <div className="relative mx-auto max-w-7xl">
            {/* Section header */}
            <div className="mb-16 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
                style={{
                  background: 'rgba(73,44,225,0.1)',
                  border: '1px solid rgba(107,79,255,0.2)',
                  color: 'var(--accent-light)',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent-light)' }} />
                Six Tools, One Suite
              </div>
              <h2
                className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
                style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}
              >
                Everything your project needs{' '}
                <span style={{ color: 'var(--accent-light)' }}>— in one place</span>
              </h2>
              <p
                className="mx-auto mt-5 max-w-xl text-base leading-relaxed"
                style={{ color: 'var(--foreground-dim)' }}
              >
                From token creation to governance — deploy, lock, vest, airdrop, vote, and launch. 
                All on LitVM. All battle-tested.
              </p>
            </div>

            {/* Tool cards grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {utilities.map(({ href, icon: Icon, name, tagline, description, fee, gradient }) => (
                <Link
                  key={href}
                  href={href}
                  className="group relative flex flex-col rounded-2xl p-6 transition-all duration-300"
                  style={{
                    background: gradient,
                    border: '1px solid rgba(107,79,255,0.1)',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(107,79,255,0.35)'
                    el.style.boxShadow = '0 0 40px rgba(73,44,225,0.1), inset 0 1px 0 rgba(107,79,255,0.1)'
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(107,79,255,0.1)'
                    el.style.boxShadow = 'none'
                    el.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Icon + fee row */}
                  <div className="mb-5 flex items-start justify-between">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{
                        background: 'rgba(73,44,225,0.15)',
                        border: '1px solid rgba(107,79,255,0.15)',
                      }}
                    >
                      <Icon size={22} strokeWidth={1.6} style={{ color: 'var(--accent-light)' }} />
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: 'rgba(255,184,0,0.08)',
                        color: '#FFB800',
                        border: '1px solid rgba(255,184,0,0.2)',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FFB800' }} />
                      Testnet
                    </span>
                  </div>

                  {/* Name + tagline */}
                  <h3
                    className="mb-1 text-lg font-semibold"
                    style={{ fontFamily: 'var(--font-heading)', color: '#FFFFFF' }}
                  >
                    {name}
                  </h3>
                  <p className="mb-3 text-sm font-medium" style={{ color: 'var(--accent-light)' }}>
                    {tagline}
                  </p>

                  {/* Description */}
                  <p
                    className="mb-5 flex-1 text-sm leading-relaxed"
                    style={{ color: 'var(--foreground-dim)' }}
                  >
                    {description}
                  </p>

                  {/* Footer: fee + arrow */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Fee: {fee}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-sm font-medium transition-all duration-200"
                      style={{ color: 'var(--accent-light)' }}
                    >
                      Open
                      <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: Why Lester Labs — Trust Pillars
        ═══════════════════════════════════════════════════════════════ */}
        <section
          className="relative px-4 py-24 sm:px-6 lg:px-8"
          style={{
            background: 'linear-gradient(180deg, var(--background) 0%, var(--surface-1) 50%, var(--background) 100%)',
          }}
        >
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-14 text-center text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Built different. Built to last.
            </h2>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                {
                  icon: '🔒',
                  title: 'Battle-Tested Contracts',
                  body: 'Forked 1:1 from OpenZeppelin, Unicrypt, Disperse, and Snapshot. No custom logic means no new attack surface.',
                },
                {
                  icon: '⚡',
                  title: 'Built for LitVM Day One',
                  body: 'The first DeFi utility suite on LitVM. Get your project running from the moment mainnet launches.',
                },
                {
                  icon: '🐾',
                  title: 'Backed by the Community',
                  body: 'Built by the team behind QuickSwap, SparkDex, and Polygon. Grant-supported by the LitVM Foundation.',
                },
              ].map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl p-6"
                  style={{
                    background: 'rgba(73,44,225,0.04)',
                    border: '1px solid rgba(107,79,255,0.08)',
                  }}
                >
                  <div className="mb-4 text-3xl">{icon}</div>
                  <h3
                    className="mb-2 text-base font-semibold"
                    style={{ fontFamily: 'var(--font-heading)', color: '#FFFFFF' }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: Developer / Docs Grid
            Osmosis-style 2x2 card grid
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            {/* Section header */}
            <div className="mb-14 text-center">
              <h2
                className="text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                For Builders
              </h2>
              <p
                className="mx-auto mt-3 max-w-lg text-base"
                style={{ color: 'var(--foreground-dim)' }}
              >
                Docs, grants, open-source contracts, and community — everything you need to ship on LitVM.
              </p>
            </div>

            {/* 2x2 card grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {devCards.map(({ icon: Icon, title, description, link, linkLabel, external }) => (
                <a
                  key={title}
                  href={link}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className="group flex flex-col rounded-2xl p-6 transition-all duration-300"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid rgba(107,79,255,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(107,79,255,0.25)'
                    el.style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'rgba(107,79,255,0.08)'
                    el.style.background = 'var(--surface-1)'
                  }}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      background: 'rgba(73,44,225,0.12)',
                      border: '1px solid rgba(107,79,255,0.1)',
                    }}
                  >
                    <Icon size={18} strokeWidth={1.6} style={{ color: 'var(--accent-light)' }} />
                  </div>
                  <h3
                    className="mb-1.5 text-base font-semibold"
                    style={{ fontFamily: 'var(--font-heading)', color: '#FFFFFF' }}
                  >
                    {title}
                  </h3>
                  <p
                    className="mb-4 flex-1 text-sm leading-relaxed"
                    style={{ color: 'var(--foreground-dim)' }}
                  >
                    {description}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: 'var(--accent-light)' }}
                  >
                    {linkLabel}
                    <ExternalLink size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5: Final CTA
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-28 sm:px-6 lg:px-8">
          {/* Background glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(73,44,225,0.12) 0%, transparent 70%)',
            }}
          />

          <div className="relative mx-auto max-w-2xl text-center">
            <h2
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}
            >
              Ready to build on{' '}
              <span style={{ color: 'var(--accent-light)' }}>LitVM</span>?
            </h2>
            <p
              className="mx-auto mt-5 max-w-lg text-base leading-relaxed"
              style={{ color: 'var(--foreground-dim)' }}
            >
              Deploy a token, lock liquidity, set up vesting — all in minutes. 
              Testnet is live now. Mainnet launches with LitVM.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/launch"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 30px rgba(73,44,225,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 50px rgba(73,44,225,0.5)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(73,44,225,0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Launch a Token
                <ArrowRight size={16} />
              </Link>
              <a
                href="https://docs.litvm.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: 'rgba(107,79,255,0.25)',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Read the Docs
                <ExternalLink size={14} />
              </a>
            </div>

            <p
              className="mt-8 text-xs"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Powered by battle-tested contracts · Built for LitVM · Grant-supported by the LitVM Foundation
            </p>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════════════════════════════ */}
        <footer
          className="px-4 py-14 sm:px-6 lg:px-8"
          style={{
            borderTop: '1px solid rgba(107,79,255,0.08)',
            background: 'var(--background-deep)',
          }}
        >
          <div className="mx-auto max-w-7xl">
            {/* Top row */}
            <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
              {/* Brand */}
              <div>
                <p
                  className="text-base font-bold"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  <span style={{ color: '#6B4FFF', marginRight: 6 }}>◆</span>
                  LESTER<span style={{ color: '#492CE1' }}>LABS</span>
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>
                  The DeFi utility suite for LitVM. Deploy, lock, vest, airdrop, vote, and launch — all in one place.
                </p>
              </div>

              {/* Link columns */}
              <div className="flex gap-16">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Tools
                  </p>
                  <div className="flex flex-col gap-2">
                    {['Launch', 'Locker', 'Vesting', 'Airdrop', 'Governance', 'Launchpad'].map((label) => (
                      <Link
                        key={label}
                        href={`/${label.toLowerCase()}`}
                        className="text-sm transition-colors"
                        style={{ color: 'var(--foreground-dim)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--foreground-dim)' }}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Resources
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Docs', href: 'https://docs.litvm.com' },
                      { label: 'GitHub', href: '#' },
                      { label: 'Twitter/X', href: 'https://twitter.com/LesterLabs' },
                      { label: 'Discord', href: '#' },
                    ].map(({ label, href }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm transition-colors"
                        style={{ color: 'var(--foreground-dim)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--foreground-dim)' }}
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div
              className="mt-12 pt-6"
              style={{ borderTop: '1px solid rgba(107,79,255,0.06)' }}
            >
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  © 2026 Lester Labs. Built on LitVM.
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  Use at your own risk. Smart contracts are unaudited on testnet. Not financial advice.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
