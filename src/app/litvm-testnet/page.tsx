import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM Testnet — Complete Getting Started Guide | Lester Labs',
  description: 'Get started on LitVM testnet. Add the network to your wallet, claim test zkLTC, explore the DEX, launchpad, airdrop tool and more — all on LitVM testnet (chain ID 4441).',
  alternates: { canonical: 'https://www.lester-labs.com/litvm-testnet' },
  openGraph: {
    title: 'LitVM Testnet — Complete Getting Started Guide | Lester Labs',
    description: 'Get started on LitVM testnet. Add the network, claim test zkLTC, explore the DEX, launchpad, airdrop tool and more — all on LitVM testnet (chain ID 4441).',
    url: 'https://www.lester-labs.com/litvm-testnet',
    siteName: 'Lester Labs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LitVM Testnet — Complete Getting Started Guide | Lester Labs',
    description: 'Get started on LitVM testnet. Add the network, claim test zkLTC, and explore every DeFi tool in the Lester Labs ecosystem.',
  },
}

const features = [
  {
    title: 'Add LitVM testnet in seconds',
    body: 'Add LitVM testnet (chain ID 4441) directly to MetaMask, Rabby, or any EVM-compatible wallet. RPC: https://liteforge.rpc.caldera.xyz/infra-partner-http. No custom wallet required.',
  },
  {
    title: 'Claim test zkLTC from the faucet',
    body: 'Get free test zkLTC from the LitVM testnet faucet. Test transactions cost nothing — you can deploy tokens, swap, lock liquidity, and run airdrops without spending real funds.',
  },
  {
    title: 'Explore the full DeFi stack',
    body: 'Test every Lester Labs tool on testnet before committing real capital. Deploy a token at /launch, seed liquidity at /pool, run an airdrop at /airdrop — everything is live and functional.',
  },
  {
    title: 'Block explorer for verification',
    body: 'Every transaction is recorded on the LitVM testnet block explorer. Verify contract deployments, token transfers, and liquidity locks directly on-chain at liteforge.explorer.caldera.xyz.',
  },
  {
    title: 'Identical to mainnet mechanics',
    body: 'Testnet mirrors mainnet exactly — same contract addresses, same fee structure, same mechanics. What works on testnet will work when LitVM mainnet launches.',
  },
  {
    title: 'No KYC, no account needed',
    body: 'Connect your wallet and start building. No sign-up, no KYC, no gatekeeping. LitVM testnet is open to anyone with an EVM wallet.',
  },
]

const steps = [
  {
    n: '01',
    title: 'Add LitVM testnet to your wallet',
    body: 'Open MetaMask or your preferred wallet. Go to Settings → Networks → Add Network. Enter chain ID 4441, name LitVM Testnet, RPC URL https://liteforge.rpc.caldera.xyz/infra-partner-http, block explorer https://liteforge.explorer.caldera.xyz.',
  },
  {
    n: '02',
    title: 'Claim test zkLTC',
    body: 'Visit the LitVM testnet faucet to claim free test zkLTC. You will need a small amount to deploy contracts and pay gas. The faucet is open and no-wallet-limit for testnet purposes.',
  },
  {
    n: '03',
    title: 'Connect to a Lester Labs tool',
    body: 'Navigate to any Lester Labs tool and connect your wallet. Try /swap to trade tokens, /launch to deploy your own token, or /pool to provide liquidity to a trading pair.',
  },
  {
    n: '04',
    title: 'Verify on the block explorer',
    body: 'Find your transaction hash after any action. Paste it into the LitVM testnet block explorer to confirm the contract interaction was recorded correctly on-chain.',
  },
]

const FAQ_DATA = [
  { q: 'What is the LitVM testnet chain ID?', a: 'Chain ID 4441. Use this to add LitVM testnet to any EVM-compatible wallet.' },
  { q: 'How do I get test zkLTC?', a: 'Use the LitVM testnet faucet to claim free test zkLTC. No limit for testnet purposes.' },
  { q: 'What RPC should I use for LitVM testnet?', a: 'https://liteforge.rpc.caldera.xyz/infra-partner-http — or the public RPC if the partner endpoint is at capacity.' },
  { q: 'Are the tools on testnet the same as mainnet?', a: 'Yes. The contracts, fee structure, and UI are identical. Testnet is the staging environment before LitVM mainnet launch.' },
  { q: 'Do I need an account to use LitVM testnet?', a: 'No. Connect any EVM wallet — no sign-up, no KYC, no account required.' },
  { q: 'Can I deploy my own token on LitVM testnet?', a: 'Yes. Use the Token Factory at /launch to deploy an ERC-20 token on LitVM testnet. It is immediately available for trading and liquidity provision.' },
]

export default function LitvmTestnetPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="noise-overlay">
        <section style={{
          minHeight: '60vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center',
          padding: '80px 24px 60px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(107,79,255,1px) 1px, transparent 1px), linear-gradient(90deg, rgba(107,79,255,1px) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute',
            top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: '600px', height: '400px',
            background: 'radial-gradient(ellipse, rgba(100,191,211,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#64BFD3', background: 'rgba(100,191,211,0.1)',
              border: '1px solid rgba(100,191,211,0.2)', borderRadius: '6px',
              padding: '4px 12px', marginBottom: '24px',
            }}>
              Getting Started
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-poppins, Poppins, sans-serif)',
            }}>
              LitVM Testnet
            </h1>
            <p style={{
              fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
              maxWidth: '540px', margin: '0 auto 32px',
            }}>
              The complete getting started guide for LitVM testnet. Add the network, claim test tokens, and explore every DeFi tool in the Lester Labs ecosystem — no real funds required.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/swap" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: '#6B4FFF', color: 'white',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
              }}>
                Open the DEX →
              </Link>
              <Link href="/docs" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px',
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
              }}>
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: '60px 24px', maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
              Everything you need to get started on LitVM testnet
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
              Testnet is open, free, and fully functional. Every tool is live.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {features.map((f) => (
              <div key={f.title} style={{
                padding: '24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#64BFD3', marginBottom: '8px', letterSpacing: '0.04em' }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{
          padding: '60px 24px',
          background: 'rgba(100,191,211,0.03)',
          borderTop: '1px solid rgba(100,191,211,0.08)',
          borderBottom: '1px solid rgba(100,191,211,0.08)',
        }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
              How to get started in four steps
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {steps.map((s) => (
                <div key={s.n} style={{
                  display: 'flex', gap: '24px', alignItems: 'flex-start',
                  padding: '24px', background: 'rgba(255,255,255,0.025)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#64BFD3',
                    background: 'rgba(100,191,211,0.12)', border: '1px solid rgba(100,191,211,0.2)',
                    borderRadius: '6px', padding: '4px 10px', flexShrink: 0, marginTop: '2px',
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{s.title}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '60px 24px', maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FAQ_DATA.map((faq) => (
              <div key={faq.q} style={{
                padding: '20px 24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'rgba(255,255,255,0.85)' }}>{faq.q}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '80px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, marginBottom: '16px' }}>
            Start building on LitVM testnet
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '16px' }}>
            Connect your wallet, add LitVM testnet, and explore every tool without spending real funds.
          </p>
          <Link href="/swap" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 32px', background: '#6B4FFF', color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none',
          }}>
            Open LitVM DEX →
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
