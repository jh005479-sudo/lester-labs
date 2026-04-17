'use client'

import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { BookOpen, Zap, Shield, Coins, ArrowRight, Layers, Clock } from 'lucide-react'
import { TUTORIALS } from '@/lib/tutorials-content'

const CATEGORY_META: Record<string, { icon: typeof Zap; color: string; gradient: string }> = {
  'Getting Started': { icon: Zap, color: '#818cf8', gradient: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 100%)' },
  'dApp Guides': { icon: Layers, color: '#a78bfa', gradient: 'linear-gradient(135deg, #1a0f2e 0%, #2a1a4a 100%)' },
  'Protocol Deep Dives': { icon: Shield, color: '#4ade80', gradient: 'linear-gradient(135deg, #0d1f1a 0%, #1a3330 100%)' },
  'Ecosystem': { icon: Coins, color: '#fbbf24', gradient: 'linear-gradient(135deg, #1a1500 0%, #2e2600 100%)' },
}

function ArticleCard({ article }: { article: typeof TUTORIALS[0] }) {
  return (
    <Link href={`/tutorials/${article.slug}`} style={{ textDecoration: 'none' }}>
      {/* Hero image / gradient */}
      <div style={{
        height: '140px', borderRadius: '14px 14px 0 0',
        background: article.heroGradient,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: `linear-gradient(${article.heroAccent} 1px, transparent 1px), linear-gradient(90deg, ${article.heroAccent} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
        <div style={{
          position: 'absolute', bottom: '14px', left: '16px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '3px',
            background: `${article.badgeColor}20`, color: article.badgeColor,
            border: `1px solid ${article.badgeColor}40`,
          }}>
            {article.badge}
          </span>
        </div>
        <div style={{
          position: 'absolute', top: '14px', right: '14px',
          display: 'flex', alignItems: 'center', gap: '4px',
          color: 'rgba(255,255,255,0.3)', fontSize: '10px',
        }}>
          <Clock style={{ width: '10px', height: '10px' }} />
          {article.readTime}
        </div>
      </div>

      {/* Card body */}
      <div style={{
        padding: '20px',
        background: 'var(--surface-1)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: 'none',
        borderRadius: '0 0 14px 14px',
        transition: 'border-color 0.2s',
      }}>
        <h3 style={{
          fontSize: '16px', fontWeight: 700, color: 'white',
          marginBottom: '8px', lineHeight: 1.3,
        }}>
          {article.title}
        </h3>
        <p style={{
          fontSize: '13px', color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.6, marginBottom: '14px',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {article.subtitle}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.25)',
          }}>
            {article.category}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            Read <ArrowRight style={{ width: '12px', height: '12px' }} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function TutorialsPage() {
  // Group articles by category, preserving defined order
  const categories = [...new Set(TUTORIALS.map(a => a.category))]

  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <BookOpen style={{ width: '28px', height: '28px', color: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              Documentation
            </span>
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.02em' }}>
            Tutorials & Guides
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)', maxWidth: '580px', lineHeight: 1.6 }}>
            Step-by-step guides, protocol explainers, and ecosystem deep dives for LitVM and every Lester Labs dApp.
          </p>
        </div>

        {/* Featured / Getting Started */}
        <div style={{ marginBottom: '64px' }}>
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap style={{ width: '16px', height: '16px', color: '#818cf8' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Start here</h2>
          </div>

          {/* Featured hero card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {TUTORIALS.slice(0, 3).map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>

        {/* dApp Guides */}
        <div style={{ marginBottom: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Layers style={{ width: '16px', height: '16px', color: '#a78bfa' }} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>dApp Guides</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {TUTORIALS.filter(a => a.category === 'dApp Guides').map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>

        {/* More articles */}
        {TUTORIALS.filter(a => a.category === 'Protocol Deep Dives' || a.category === 'Ecosystem').length > 0 && (
          <div style={{ marginBottom: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield style={{ width: '16px', height: '16px', color: '#fbbf24' }} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Deep Dives & Ecosystem</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {TUTORIALS.filter(a => a.category === 'Protocol Deep Dives' || a.category === 'Ecosystem').map(article => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{
          padding: '40px',
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: '16px', textAlign: 'center',
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
            Ready to build?
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', marginBottom: '24px' }}>
            Deploy your first token or launch your presale on LitVM testnet.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/launch"
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: 'var(--accent)', color: 'white',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Go to Token Factory →
            </Link>
            <Link
              href="/launchpad"
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
                fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              View Launchpad →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
