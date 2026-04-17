'use client'

import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { BookOpen, Zap, Shield, Coins, ArrowRight, Layers } from 'lucide-react'

const ARTICLES = [
  // Getting Started
  {
    category: 'Getting Started',
    icon: Zap,
    color: '#6366f1',
    articles: [
      {
        title: 'What is LitVM?',
        summary: 'A technical introduction to LitVM — a validity-proof Layer 2 for Litecoin, combiningZK proofs with EVM compatibility.',
        href: '#litvm-intro',
        badge: 'Ecosystem',
      },
      {
        title: 'Setting up your LitVM wallet',
        summary: 'How to connect MetaMask or Rabby to LitVM testnet and get the RPC configuration right first time.',
        href: '#wallet-setup',
        badge: 'Setup',
      },
      {
        title: 'Understanding zkLTC — the fuel of LitVM',
        summary: "zKatte Let's you pay fees on LitVM. Here's how to get it and why it's more efficient than shipping ETH across bridges.",
        href: '#zlktc-guide',
        badge: 'Tokens',
      },
    ],
  },
  // dApp Guides
  {
    category: 'dApp Guides',
    icon: Layers,
    color: '#8b5cf6',
    articles: [
      {
        title: 'Token Factory — launch an ERC-20 in 60 seconds',
        summary: 'A walkthrough of the Token Factory: how to deploy a fully standard ERC-20 token on LitVM without writing a line of Solidity.',
        href: '/docs/token-factory',
        badge: 'Token Factory',
      },
      {
        title: 'Launchpad — run a community presale',
        summary: 'How to configure and launch a permissionless presale on the LitVM Launchpad, set caps and timelines, and let the contract handle LP creation automatically.',
        href: '/docs/launchpad',
        badge: 'Launchpad',
      },
      {
        title: 'Liquidity Locker — lock your LP tokens',
        summary: 'How Liquidity Lockers protect your community by rendering LP tokens non-transferable until a specified unlock date — and why it matters for credibility.',
        href: '/docs/liquidity-locker',
        badge: 'Locker',
      },
      {
        title: 'Vesting — schedule token releases',
        summary: 'How to set up a vesting schedule for your team, investors, or advisors using the Lester Labs Vesting Factory — with options for cliff and linear release.',
        href: '/docs/token-vesting',
        badge: 'Vesting',
      },
      {
        title: 'Airdrop Tool — distribute tokens at scale',
        summary: 'How to use the batch airdrop tool to distribute tokens to thousands of wallets in a single transaction — with CSV upload and snapshot support.',
        href: '/docs/airdrop-tool',
        badge: 'Airdrop',
      },
      {
        title: 'The Ledger — permanent on-chain messages',
        summary: 'How to post messages directly to the LitVM blockchain using The Ledger — a social layer that lives in calldata, not on a server.',
        href: '/docs/ledger',
        badge: 'The Ledger',
      },
    ],
  },
  // Protocol Deep Dives
  {
    category: 'Protocol Deep Dives',
    icon: Shield,
    color: '#22c55e',
    articles: [
      {
        title: 'How validity proofs work on LitVM',
        summary: 'A non-technical explanation of ZK validity proofs — how LitVM compresses transaction data and proves correctness without requiring every node to re-execute everything.',
        href: '#zk-explainer',
        badge: 'Advanced',
      },
      {
        title: 'The ILO factory pattern — fair launch mechanics',
        summary: 'Breaking down how Initial Liquidity Offerings differ from IDOs: automatic LP creation, no vesting for the protocol, and how the factory pattern enables permissionless listing.',
        href: '#ilo-pattern',
        badge: 'DeFi',
      },
      {
        title: 'Why LitVM uses Groth16 proofs',
        summary: 'A look at the Groth16 proving system — why it was chosen for LitVM, how it achieves small proof sizes, and the tradeoffs versus other ZK systems.',
        href: '#groth16',
        badge: 'ZK',
      },
    ],
  },
  // Ecosystem
  {
    category: 'Ecosystem',
    icon: Coins,
    color: '#f59e0b',
    articles: [
      {
        title: 'The LitVM roadmap — what is coming',
        summary: 'An overview of the LitVM development roadmap: V3/V4 infrastructure, Algebra integration, and the path to mainnet launch.',
        href: '#litvm-roadmap',
        badge: 'LitVM',
      },
      {
        title: 'Building on LitVM — getting started as a developer',
        summary: 'How to deploy your Solidity contracts to LitVM testnet, what tools are compatible, and where to find the developer documentation.',
        href: '#dev-start',
        badge: 'Dev',
      },
    ],
  },
]

const BADGE_COLORS: Record<string, string> = {
  'Ecosystem': 'background: rgba(99,102,241,0.15); color: #818cf8; border-color: rgba(99,102,241,0.3)',
  'Setup': 'background: rgba(34,197,94,0.15); color: #4ade80; border-color: rgba(34,197,94,0.3)',
  'Tokens': 'background: rgba(245,158,11,0.15); color: #fbbf24; border-color: rgba(245,158,11,0.3)',
  'DeFi': 'background: rgba(139,92,246,0.15); color: #a78bfa; border-color: rgba(139,92,246,0.3)',
  'ZK': 'background: rgba(34,211,238,0.15); color: #22d3ee; border-color: rgba(34,211,238,0.3)',
  'Advanced': 'background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3)',
  'LitVM': 'background: rgba(99,102,241,0.15); color: #818cf8; border-color: rgba(99,102,241,0.3)',
  'Dev': 'background: rgba(16,185,129,0.15); color: #10b981; border-color: rgba(16,185,129,0.3)',
  'Default': 'background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.15)',
}

function getBadgeStyle(badge: string) {
  return BADGE_COLORS[badge] ?? BADGE_COLORS['Default']
}

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '140px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <BookOpen style={{ width: '28px', height: '28px', color: 'var(--accent)' }} />
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              Documentation
            </span>
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>
            Tutorials & Guides
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', maxWidth: '600px', lineHeight: 1.6 }}>
            Step-by-step guides, protocol explainers, and ecosystem deep dives — everything you need to go from newcomer to power user on LitVM and Lester Labs.
          </p>
        </div>

        {/* Article sections */}
        {ARTICLES.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.category} style={{ marginBottom: '64px' }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: `${section.color}18`, border: `1px solid ${section.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon style={{ width: '18px', height: '18px', color: section.color }} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{section.category}</h2>
              </div>

              {/* Article cards grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
              }}>
                {section.articles.map((article) => (
                  <Link
                    key={article.title}
                    href={article.href}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      background: 'var(--surface-1)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px',
                      padding: '24px',
                      height: '100%',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, transform 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid',
                          ...(Object.fromEntries(
                            getBadgeStyle(article.badge).split(';').map(s => {
                              const [k, v] = s.trim().split(': ')
                              return [k.trim(), v.trim()]
                            })
                          )),
                        }}>
                          {article.badge}
                        </span>
                        <ArrowRight style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '8px', lineHeight: 1.3 }}>
                          {article.title}
                        </h3>
                        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                          {article.summary}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        {/* Coming soon placeholder */}
        <div style={{
          padding: '40px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: '14px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '14px',
        }}>
          More articles coming as the LitVM ecosystem grows — including video guides, protocol audits, and integration walkthroughs.
        </div>
      </div>
    </div>
  )
}
