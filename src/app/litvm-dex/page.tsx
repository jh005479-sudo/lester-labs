import { Metadata } from 'next'
import Link from 'next/link'

const FAQ_DATA = [
  { q: 'What fee does the LitVM DEX charge?', a: '0.30% per trade. Of that, 0.20% is routed to the Lester Labs protocol treasury and 0.10% is retained in the pool for LPs.' },
  { q: 'Which tokens can I swap on LitVM?', a: 'Any ERC-20 deployed on LitVM. Use the Token Factory to deploy a new token at /launch, then pair it on the DEX.' },
  { q: 'Is there a maximum slippage setting?', a: 'Yes — slippage is configurable per transaction in the swap interface. Default is set to 0.5%.' },
  { q: 'How do I add liquidity to a LitVM pair?', a: 'Navigate to /swap and use the "Add Liquidity" panel. Alternatively, seed a pair directly through the Launchpad when running a presale.' },
  { q: 'Can I view my LP positions?', a: 'Yes. Connect your wallet at /pool to see all your liquidity provider positions, your share of each pool, and the underlying token balances.' },
  { q: 'Does the DEX work on LitVM testnet?', a: 'Yes. The LitVM DEX is live on testnet (chain ID 4441). All features, fees, and mechanics are identical to the eventual mainnet deployment.' },
]

export const metadata: Metadata = {
  title: 'LitVM DEX — Native Decentralized Exchange on LitVM | Lester Labs',
  description: 'Trade tokens directly on LitVM with the Lester Labs DEX. 0.30% per trade, 0.20% routed to the protocol treasury, zero external dependencies. The native LitVM decentralized exchange.',
  keywords: ['LitVM DEX', 'LitVM decentralized exchange', 'LitVM swap', 'Lester Labs DEX'],
  alternates: { canonical: 'https://www.lester-labs.com/litvm-dex' },
  openGraph: {
    title: 'LitVM DEX — Native Decentralized Exchange on LitVM | Lester Labs',
    description: 'Trade tokens directly on LitVM with the Lester Labs DEX. 0.30% per trade, 0.20% routed to the protocol treasury, zero external dependencies.',
    url: 'https://www.lester-labs.com/litvm-dex',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LitVM DEX — Native Decentralized Exchange on LitVM | Lester Labs',
    description: 'Trade tokens directly on LitVM with the Lester Labs DEX. 0.30% per trade, 0.20% routed to the protocol treasury.',
  },
}

const features = [
  {
    title: '0.30% per trade',
    body: 'Every swap pays 0.30% in protocol fees. 0.20% routes directly to the Lester Labs treasury. 0.10% stays in the pool as LP earnings.',
  },
  {
    title: 'Gasless intent, signed execution',
    body: 'Place a trade intent, sign a message, execute. Gas is only consumed on final settlement — not on intent submission.',
  },
  {
    title: 'Own LP infrastructure',
    body: 'Launchpad ILOs seed liquidity directly into the Lester Labs Uniswap V2 deployment. No handoff to external DEXs.',
  },
  {
    title: 'View LP positions',
    body: 'Track your liquidity provider positions across any LitVM pair from a single interface at /pool.',
  },
]

const faqs = FAQ_DATA

export default function LitvmDexPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="noise-overlay">
        {/* Hero */}
        <section style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 24px 60px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(107,79,255,1px) 1px, transparent 1px), linear-gradient(90deg, rgba(107,79,255,1px) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(107,79,255,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#8B74FF',
              background: 'rgba(107,79,255,0.1)',
              border: '1px solid rgba(107,79,255,0.2)',
              borderRadius: '6px',
              padding: '4px 12px',
              marginBottom: '24px',
            }}>
              Decentralized Exchange
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-poppins, Poppins, sans-serif)',
            }}>
              The LitVM DEX
            </h1>
            <p style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.65,
              maxWidth: '540px',
              margin: '0 auto 32px',
            }}>
              A fully native decentralized exchange for LitVM. Swap any token, earn LP fees, and contribute to protocol-owned liquidity — all without leaving the Litecoin ecosystem.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/swap"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '12px 28px',
                  background: '#6B4FFF', color: 'white',
                  borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                  textDecoration: 'none',
                  transition: 'background 0.2s',
                }}
              >
                Open the DEX →
              </Link>
              <Link
                href="/docs"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '12px 28px',
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                  borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                  textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '60px 24px', maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
              Built different. Built to last.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
              Every design decision serves the LitVM ecosystem, not external dependencies.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {features.map((f) => (
              <div key={f.title} style={{
                padding: '24px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px',
              }}>
                <div style={{
                  fontSize: '13px', fontWeight: 700, color: '#8B74FF',
                  marginBottom: '8px', letterSpacing: '0.04em',
                }}>
                  {f.title}
                </div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                  {f.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{
          padding: '60px 24px',
          background: 'rgba(107,79,255,0.03)',
          borderTop: '1px solid rgba(107,79,255,0.08)',
          borderBottom: '1px solid rgba(107,79,255,0.08)',
        }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
              How the LitVM DEX works
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { step: '01', title: 'Connect to LitVM', body: 'Add LitVM testnet (chain ID 4441) to your wallet. RPC: https://liteforge.rpc.caldera.xyz/infra-partner-http. No separate software needed.' },
                { step: '02', title: 'Approve tokens for trading', body: 'For ERC-20 tokens, approve the Lester Labs router once. This grants the router permission to move that specific token on your behalf.' },
                { step: '03', title: 'Swap and sign', body: 'Select your input and output tokens. The interface fetches a live quote from the LitVM router. Sign the message — gas is charged only on final execution.' },
                { step: '04', title: 'Liquidity is always native', body: 'Every pair on the LitVM DEX draws from pools seeded via the Lester Labs Launchpad or direct router interactions — no external DEX dependencies.' },
              ].map((item) => (
                <div key={item.step} style={{
                  display: 'flex', gap: '24px', alignItems: 'flex-start',
                  padding: '24px',
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#6B4FFF',
                    background: 'rgba(107,79,255,0.12)',
                    border: '1px solid rgba(107,79,255,0.2)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{item.title}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '60px 24px', maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq) => (
              <div key={faq.q} style={{
                padding: '20px 24px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'rgba(255,255,255,0.85)' }}>
                  {faq.q}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {faq.a}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          padding: '80px 24px',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, marginBottom: '16px' }}>
            Start trading on LitVM
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '16px' }}>
            Connect your wallet, switch to LitVM, and swap any token. Testnet is live now.
          </p>
          <Link
            href="/swap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '14px 32px',
              background: '#6B4FFF', color: 'white',
              borderRadius: '10px', fontWeight: 600, fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            Open the DEX →
          </Link>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQ_DATA.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            }),
          }}
        />
      </div>
    </div>
  )
}