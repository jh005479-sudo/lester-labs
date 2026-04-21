import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'LitVM Launchpad — Permissionless Token Launches on LitVM | Lester Labs',
  description: 'Run a token presale on LitVM with automatic LP seeding. No application, no listing fees, no team veto. The LitVM Launchpad deploys your ILO contract and seeds liquidity into the native DEX.',
  keywords: ['LitVM launchpad', 'LitVM token launch', 'LitVM ILO', 'LitVM presale', 'LitVM token sale'],
}

const features = [
  { title: 'Fully permissionless', body: 'No application, no approval process, no listing committee. If you have a token and a community, you can launch. The contract enforces the rules on-chain — no backend can intervene.' },
  { title: 'Automatic LP seeding', body: 'When your presale finalises, liquidity is automatically seeded into the Lester Labs Uniswap V2 deployment on LitVM. No manual LP creation, no DEX listing step.' },
  { title: '0.03 zkLTC + 2% raise fee', body: 'A flat creation fee of 0.03 zkLTC plus 2% of the total raise. No hidden costs, no monthly fees, no subscription.' },
  { title: 'Configurable caps and timelines', body: 'Set soft cap, hard cap, start time, end time, and contribution limits. The ILO contract enforces all parameters — no admin override mid-sale.' },
  { title: 'LP lock enforcement', body: 'Set a lock duration for LP tokens created at finalisation. LP tokens are non-transferable until the unlock date — permanently, immutably, on-chain.' },
  { title: 'Runs on LitVM', body: 'Every presale, finalisation, and LP creation is executed on LitVM testnet (chain ID 4441). The mechanics are identical to the eventual LitVM mainnet launchpad.' },
]

const faqs = [
  { q: 'How does the LitVM Launchpad work?', a: 'Create a presale contract, deposit your token allocation, set your caps and timeline, and go live. When the presale ends (or the hard cap is hit), the ILO factory automatically seeds liquidity into the Lester Labs Uniswap V2 router on LitVM.' },
  { q: 'What does it cost to launch a presale on LitVM?', a: '0.03 zkLTC to create the ILO contract, plus 2% of the total raise taken at finalisation. That is the complete cost — no listing fees, no subscription.' },
  { q: 'Do I need my own token already?', a: 'Yes. You need an ERC-20 deployed on LitVM before creating a presale. Use the Token Factory at /launch to deploy one in under a minute.' },
  { q: 'What is automatic LP seeding?', a: 'When your presale finalises, the raised zkLTC and your deposited tokens are sent simultaneously to the Uniswap V2 pair contract. The resulting LP tokens are created and locked according to your configured duration — automatically, with no manual step.' },
  { q: 'Can I set a whitelist for the presale?', a: 'You can configure contribution limits per wallet. For stricter whitelist control, the contract supports this at the configuration stage.' },
  { q: 'Is the LitVM Launchpad live?', a: 'Yes — live on LitVM testnet (chain ID 4441). Use test zkLTC and test tokens. All mechanics and fees are identical to the mainnet deployment.' },
]

export default function LitvmLaunchpadPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div className="noise-overlay">
        <section style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '80px 24px 60px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(107,79,255,1px) 1px, transparent 1px), linear-gradient(90deg, rgba(107,79,255,1px) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
          <div style={{
            position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
            width: '600px', height: '400px',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px' }}>
            <div style={{
              display: 'inline-block', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#a78bfa', background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px',
              padding: '4px 12px', marginBottom: '24px',
            }}>
              Token Launchpad
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-0.02em', marginBottom: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-poppins, Poppins, sans-serif)',
            }}>
              LitVM Launchpad
            </h1>
            <p style={{
              fontSize: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
              maxWidth: '540px', margin: '0 auto 32px',
            }}>
              Permissionless token launches on LitVM. Run your ILO, seed your own liquidity, give your community a fair shot. No gatekeepers, no listing fees, no veto.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/launchpad" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 28px', background: '#6B4FFF', color: 'white',
                borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
              }}>
                Open Launchpad →
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
              The LitVM launchpad for builders
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}>
              Every feature is on-chain, immutable, and community-verifiable. No backend, no admin keys, no surprises.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {features.map((f) => (
              <div key={f.title} style={{
                padding: '24px', background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', marginBottom: '8px', letterSpacing: '0.04em' }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{
          padding: '60px 24px',
          background: 'rgba(139,92,246,0.03)',
          borderTop: '1px solid rgba(139,92,246,0.08)',
          borderBottom: '1px solid rgba(139,92,246,0.08)',
        }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>
              How a LitVM token launch works
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { n: '01', title: 'Deploy your token', body: 'Use the Token Factory at /launch to deploy an ERC-20 on LitVM. It takes under a minute and costs 0.05 zkLTC.' },
                { n: '02', title: 'Create your presale', body: 'Navigate to /launchpad, paste your token address, set caps, price, timeline, and LP lock duration. Pay the 0.03 zkLTC creation fee.' },
                { n: '03', title: 'Deposit your tokens', body: 'Transfer your full presale token allocation to the newly created ILO contract address. The contract holds them until the sale ends.' },
                { n: '04', title: 'Launch and finalise', body: 'Contributors send zkLTC to the presale contract. When it ends, the ILO factory automatically seeds LP on the LitVM DEX. LP is locked for your configured duration.' },
              ].map((s) => (
                <div key={s.n} style={{
                  display: 'flex', gap: '24px', alignItems: 'flex-start',
                  padding: '24px', background: 'rgba(255,255,255,0.025)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: '#a78bfa',
                    background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)',
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
            {faqs.map((faq) => (
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
            Launch your token on LitVM
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '32px', fontSize: '16px' }}>
            No application. No gatekeepers. Deploy, raise, and seed liquidity — all on LitVM.
          </p>
          <Link href="/launchpad" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 32px', background: '#6B4FFF', color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '15px', textDecoration: 'none',
          }}>
            Open LitVM Launchpad →
          </Link>
        </section>
      </div>
    </div>
  )
}