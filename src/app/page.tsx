'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Coins, Lock, Clock, Send, Users, Rocket, ChevronDown } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { LTCBanner } from '@/components/LTCBanner'

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

const faqs = [
  {
    question: 'Is this free to use?',
    answer:
      'Each utility has a small protocol fee paid in zkLTC (the native gas token on LitVM). Fees are shown before you sign any transaction. Governance voting is always free.',
  },
  {
    question: 'Are the contracts audited?',
    answer:
      'Our contracts are forked 1:1 from battle-tested implementations — OpenZeppelin, Unicrypt, Disperse, and Snapshot. We deliberately avoid custom logic to minimize attack surface. Testnet is unaudited; a formal audit will be completed before mainnet.',
  },
  {
    question: 'What wallet do I need?',
    answer:
      'Any EVM-compatible wallet works — MetaMask, WalletConnect, Coinbase Wallet, Rabby, etc. Make sure to add LitVM (or Arbitrum Sepolia for testnet) as a network.',
  },
  {
    question: 'When does mainnet launch?',
    answer:
      'Lester-Labs launches on LitVM mainnet day one. Until then, you can test all utilities on Arbitrum Sepolia using free testnet ETH.',
  },
  {
    question: 'Who is behind Lester-Labs?',
    answer:
      "Built by the team behind QuickSwap, SparkDex, and Polygon, with grant support from the LitVM Foundation. We're committed to the long-term success of the Litecoin and LitVM ecosystem.",
  },
]

const socials = [
  {
    name: 'Twitter/X',
    href: 'https://twitter.com/LesterLabs',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: 'Telegram',
    href: 'https://t.me/LesterLabs',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/LesterLabs',
    icon: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
      </svg>
    ),
  },
]

/* ─── FAQ Accordion ────────────────────────────────────────────────── */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-white"
        style={{ color: isOpen ? '#fff' : 'rgba(237,237,237,0.8)' }}
      >
        <span className="text-base font-medium pr-4">{question}</span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'rgba(237,237,237,0.4)' }}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(237,237,237,0.5)' }}>
          {answer}
        </p>
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />
      <LTCBanner />

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

        {/* ── Section 4: FAQ ───────────────────────────────────────────── */}
        <section className="px-4 py-20 sm:px-6 lg:px-8" style={{ background: 'var(--background)' }}>
          <div className="mx-auto max-w-3xl">
            <h2
              className="mb-3 text-center text-2xl font-bold tracking-tight"
              style={{ color: 'var(--foreground)' }}
            >
              Frequently Asked Questions
            </h2>
            <p className="mb-10 text-center text-sm" style={{ color: 'rgba(237,237,237,0.4)' }}>
              Quick answers to common questions
            </p>

            <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {faqs.map((faq) => (
                <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>

            {/* More questions CTA */}
            <div className="mt-8 text-center">
              <p className="text-sm" style={{ color: 'rgba(237,237,237,0.4)' }}>
                Still have questions?{' '}
                <a
                  href="https://t.me/LesterLabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  Ask in Telegram →
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 5: Community / Socials CTA ───────────────────────── */}
        <section
          className="border-t px-4 py-16 sm:px-6 lg:px-8"
          style={{
            background: 'var(--surface-1)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className="mb-3 text-xl font-bold tracking-tight"
              style={{ color: 'var(--foreground)' }}
            >
              Join the Community
            </h2>
            <p className="mb-8 text-sm" style={{ color: 'rgba(237,237,237,0.45)' }}>
              Get updates, ask questions, and connect with the LitVM ecosystem.
            </p>

            <div className="flex items-center justify-center gap-4">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: 'rgba(237,237,237,0.8)',
                  }}
                >
                  {social.icon}
                  <span>{social.name}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 6: Footer ────────────────────────────────────────── */}
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
