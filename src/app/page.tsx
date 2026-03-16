'use client'

import Link from 'next/link'
import { Coins, Lock, Clock, Send, Users, Rocket, BookOpen, Github, MessageCircle, Gift, ArrowRight, ExternalLink } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import ScrollHero from '@/components/home/ScrollHero'

const utilities = [
  { href: '/launch',     icon: Coins,  name: 'Token Factory',    tagline: 'Deploy ERC-20 tokens in 3 steps',    description: 'No coding required. Configure supply, name, and optional features — then deploy. Your token is live in under a minute.',          fee: '0.05 zkLTC', num: '01' },
  { href: '/locker',     icon: Lock,   name: 'Liquidity Locker', tagline: 'Lock LP tokens with proof',          description: 'Lock liquidity and generate a shareable on-chain certificate. Build trust with your community from day one.',               fee: '0.03 zkLTC', num: '02' },
  { href: '/vesting',    icon: Clock,  name: 'Token Vesting',    tagline: 'Linear & cliff schedules',           description: 'Set vesting schedules for team and investor allocations. Tokens release automatically — no manual claims needed.',          fee: '0.03 zkLTC', num: '03' },
  { href: '/airdrop',    icon: Send,   name: 'Airdrop Tool',     tagline: 'Batch send in one transaction',      description: 'Send tokens to hundreds of wallets at once. CSV import supported. Perfect for community rewards and distributions.',       fee: '0.01 zkLTC', num: '04' },
  { href: '/governance', icon: Users,  name: 'Governance',       tagline: 'Gasless community voting',           description: 'Create proposals and let token holders vote. Snapshot-style governance with no gas costs for voters.',                    fee: 'Free',       num: '05' },
  { href: '/launchpad',  icon: Rocket, name: 'Launchpad',        tagline: 'Permissionless presales',            description: 'Community presales with automatic SparkDex LP creation and locking. Self-service, no gatekeepers.',                       fee: '0.03 zkLTC + 2%', num: '06' },
]

const devCards = [
  { icon: BookOpen,       title: 'Documentation', description: 'Guides, API reference, and integration walkthroughs.',    link: 'https://docs.litvm.com', linkLabel: 'Read the Docs' },
  { icon: Gift,           title: 'LitVM Grants',  description: 'Grants for teams shipping real infrastructure.',           link: 'https://litvm.com',      linkLabel: 'Apply' },
  { icon: Github,         title: 'Open Source',   description: 'Battle-tested contracts. Verify everything on-chain.',     link: 'https://github.com',     linkLabel: 'GitHub' },
  { icon: MessageCircle,  title: 'Community',     description: 'Builders, degens, and dreamers shipping together.',        link: 'https://discord.gg',     linkLabel: 'Discord' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen noise-overlay" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar />
      <main>

        {/* HERO */}
        <ScrollHero />

        {/* SECTION 2: Tool Showcase */}
        <section className="relative px-6 pt-32 pb-40 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-24 fade-up">
              <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: 'var(--accent)' }}>The Suite</p>
              <h2 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.05 }}>
                Six tools. <br /><span style={{ color: 'var(--foreground-dim)' }}>One platform.</span>
              </h2>
            </div>

            <div className="flex flex-col">
              {utilities.map(({ href, icon: Icon, name, tagline, description, fee, num }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`group flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-12 py-10 transition-all duration-500 fade-up fade-up-d${Math.min(i + 1, 6)}`}
                  style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderTopColor = 'rgba(107,79,255,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.04)' }}
                >
                  <span className="shrink-0 text-[11px] font-mono tracking-wider pt-1" style={{ color: 'var(--foreground-muted)', width: '32px' }}>{num}</span>
                  <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110" style={{ background: 'var(--accent-muted)', border: '1px solid rgba(107,79,255,0.08)' }}>
                    <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-2">
                      <h3 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ fontFamily: 'var(--font-heading)' }}>{name}</h3>
                      <span className="hidden sm:inline text-[12px]" style={{ color: 'var(--foreground-muted)' }}>{tagline}</span>
                    </div>
                    <p className="max-w-lg text-sm leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>{description}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2 pt-1">
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>{fee}</span>
                    <ArrowRight size={16} className="transition-all duration-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: 'var(--accent)' }} />
                  </div>
                </Link>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
            </div>
          </div>
        </section>

        {/* SECTION 3: Trust Pillars */}
        <section className="px-6 py-24 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="section-line mb-20" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-16 sm:gap-8">
              {[
                { label: 'Contracts', value: 'Battle-Tested', sub: 'Forked 1:1 from OpenZeppelin, Unicrypt, Disperse & Snapshot' },
                { label: 'Ecosystem', value: 'LitVM Native',  sub: 'First DeFi utility suite — live from day one of mainnet launch' },
                { label: 'Backed By', value: 'Community',     sub: 'Built by the team behind QuickSwap & SparkDex. Foundation-supported.' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="fade-up">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>{label}</p>
                  <p className="mb-3 text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{value}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: For Builders */}
        <section className="px-6 py-32 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="section-line mb-20" />
            <div className="mb-16 fade-up">
              <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.25em]" style={{ color: 'var(--accent)' }}>Developers</p>
              <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>For Builders</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', overflow: 'hidden' }}>
              {devCards.map(({ icon: Icon, title, description, link, linkLabel }) => (
                <a
                  key={title}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col p-8 sm:p-10 transition-all duration-500"
                  style={{ background: 'var(--background)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--background)' }}
                >
                  <Icon size={20} strokeWidth={1.5} className="mb-5" style={{ color: 'var(--foreground-muted)' }} />
                  <h3 className="mb-2 text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{title}</h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>{description}</p>
                  <span className="inline-flex items-center gap-2 text-[13px] transition-all duration-300 group-hover:gap-3" style={{ color: 'var(--foreground-dim)' }}>
                    {linkLabel}
                    <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 5: CTA */}
        <section className="relative px-6 py-40 sm:px-8 lg:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 40% 40% at 50% 50%, rgba(107,79,255,0.06) 0%, transparent 70%)' }} />
          <div className="relative mx-auto max-w-3xl text-center fade-up">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl" style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.05 }}>
              Ready to build <br /><span className="gradient-text">on LitVM?</span>
            </h2>
            <p className="mx-auto mt-8 max-w-md text-base leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>
              Deploy a token, lock liquidity, set up vesting — all in minutes. Testnet is live. Mainnet launches with LitVM.
            </p>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
              <Link href="/launch" className="cin-btn">Launch a Token <ArrowRight size={15} /></Link>
              <a href="https://docs.litvm.com" target="_blank" rel="noopener noreferrer" className="cin-btn cin-btn-ghost">Read the Docs <ExternalLink size={13} /></a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="px-6 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="section-line mb-12" />
            <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
              <div>
                <p className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.15em' }}>
                  Lester<span style={{ color: 'var(--accent)' }}>Labs</span>
                </p>
                <p className="mt-3 max-w-xs text-[13px] leading-relaxed" style={{ color: 'var(--foreground-dim)' }}>The DeFi utility suite for LitVM.</p>
              </div>
              <div className="flex gap-16">
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--foreground-muted)' }}>Tools</p>
                  {['Launch','Locker','Vesting','Airdrop','Governance','Launchpad'].map((l) => (
                    <Link key={l} href={`/${l.toLowerCase()}`} className="text-[13px] transition-colors duration-300 hover:text-white" style={{ color: 'var(--foreground-dim)' }}>{l}</Link>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--foreground-muted)' }}>Links</p>
                  {[{ label:'Docs', href:'https://docs.litvm.com' },{ label:'GitHub', href:'#' },{ label:'Twitter/X', href:'https://twitter.com/LesterLabs' },{ label:'Discord', href:'#' }].map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] transition-colors duration-300 hover:text-white" style={{ color: 'var(--foreground-dim)' }}>{label}</a>
                  ))}
                </div>
              </div>
            </div>
            <div className="section-line mt-12 mb-8" />
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-[11px]" style={{ color: 'var(--foreground-muted)' }}>© 2026 Lester Labs. Built on LitVM.</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.1)' }}>Unaudited testnet. Not financial advice.</p>
            </div>
          </div>
        </footer>

      </main>
    </div>
  )
}
