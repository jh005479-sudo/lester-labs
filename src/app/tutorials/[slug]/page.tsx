'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowLeft, Clock, BookOpen, ArrowRight, Info, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react'
import { getArticle, getRelatedArticles, type TutorialArticle, type TutorialSection } from '@/lib/tutorials-content'

// ── Hero ────────────────────────────────────────────────────────────────────

function ArticleHero({ article }: { article: TutorialArticle }) {
  return (
    <div
      style={{
        background: article.heroGradient,
        borderBottom: `1px solid ${article.heroAccent}22`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${article.heroAccent} 1px, transparent 1px), linear-gradient(90deg, ${article.heroAccent} 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {/* Accent orb */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: `radial-gradient(circle, ${article.heroAccent}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 24px 48px', position: 'relative' }}>
        {/* Back link */}
        <Link
          href="/tutorials"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none',
            marginBottom: '32px', transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          All Tutorials
        </Link>

        {/* Badge + meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: '4px', border: `1px solid ${article.badgeColor}50`,
            background: `${article.badgeColor}18`, color: article.badgeColor,
          }}>
            {article.badge}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {article.readTime}
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800,
          letterSpacing: '-0.02em', lineHeight: 1.1, color: 'white',
          marginBottom: '20px',
        }}>
          {article.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '18px', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)',
          maxWidth: '640px',
        }}>
          {article.subtitle}
        </p>
      </div>
    </div>
  )
}

// ── Callout block ───────────────────────────────────────────────────────────

const CALLOUT_CONFIG = {
  info: { icon: Info, bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' },
  warning: { icon: AlertTriangle, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#fbbf24' },
  tip: { icon: Lightbulb, bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: '#4ade80' },
}

function Callout({ callout }: { callout: { type: 'info' | 'warning' | 'tip'; text: string } }) {
  const cfg = CALLOUT_CONFIG[callout.type]
  const Icon = cfg.icon
  return (
    <div style={{
      display: 'flex', gap: '14px', padding: '16px 18px',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: '10px', margin: '28px 0',
    }}>
      <Icon style={{ width: '18px', height: '18px', color: cfg.color, flexShrink: 0, marginTop: '2px' }} />
      <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{callout.text}</p>
    </div>
  )
}

// ── Code block ───────────────────────────────────────────────────────────────

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  return (
    <div style={{
      margin: '24px 0', borderRadius: '10px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        padding: '10px 16px', background: 'rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{lang}</span>
      </div>
      <pre style={{
        margin: 0, padding: '16px 20px', background: '#0a0a14',
        overflowX: 'auto', fontSize: '13px', lineHeight: 1.65,
        color: '#a5f3fc', fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
      }}>
        {content}
      </pre>
    </div>
  )
}

// ── Step list ───────────────────────────────────────────────────────────────

function StepList({ heading, steps }: { heading: string; steps: { title: string; body: string }[] }) {
  return (
    <div style={{ margin: '28px 0' }}>
      {heading && (
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '20px' }}>{heading}</h2>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '20px', paddingBottom: i < steps.length - 1 ? '28px' : 0 }}>
            {/* Step number */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: '#818cf8',
              }}>
                {i + 1}
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{
                  width: '1px', height: '100%', minHeight: '40px',
                  background: 'rgba(99,102,241,0.15)', margin: '8px auto 0',
                }} />
              )}
            </div>
            <div style={{ paddingTop: '4px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{step.title}</h3>
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-line' }}>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section renderer ────────────────────────────────────────────────────────

function Section({ section }: { section: TutorialSection }) {
  if (section.type === 'callout') {
    return <Callout callout={section.callout!} />
  }
  if (section.type === 'code') {
    return <CodeBlock lang={section.code!.lang} content={section.code!.content} />
  }
  if (section.type === 'step') {
    return <StepList heading={section.heading ?? ''} steps={section.steps!} />
  }
  if (section.type === 'image') {
    return (
      <figure style={{ margin: '28px 0' }}>
        <div style={{
          width: '100%', aspectRatio: '16/7', borderRadius: '12px', overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={section.src ?? ''} alt={section.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {section.caption && (
          <figcaption style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
            {section.caption}
          </figcaption>
        )}
      </figure>
    )
  }
  // Default: text section
  return (
    <div style={{ margin: '28px 0' }}>
      {section.heading && (
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'white', marginBottom: '14px', letterSpacing: '-0.01em' }}>
          {section.heading}
        </h2>
      )}
      {section.body && (
        <p style={{ fontSize: '16px', lineHeight: 1.8, color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-line' }}>
          {section.body}
        </p>
      )}
    </div>
  )
}

// ── Related articles ────────────────────────────────────────────────────────

function RelatedArticles({ articles }: { articles: TutorialArticle[] }) {
  if (!articles.length) return null
  return (
    <div style={{
      marginTop: '64px', paddingTop: '40px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '24px' }}>
        Continue reading
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {articles.map(article => (
          <Link key={article.slug} href={`/tutorials/${article.slug}`} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '20px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
              transition: 'border-color 0.2s, background 0.2s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${article.heroAccent}40`
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: article.badgeColor, marginBottom: '8px',
              }}>
                {article.badge}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '6px', lineHeight: 1.3 }}>
                {article.title}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {article.readTime} <ArrowRight style={{ width: '12px', height: '12px' }} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function TutorialArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const article = getArticle(slug)
  const related = article?.related ? getRelatedArticles(article.related) : []

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Navbar />
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '160px 24px', textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Navbar />
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '160px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Article not found</div>
          <Link href="/tutorials" style={{ color: 'var(--accent)', fontSize: '14px' }}>← Back to tutorials</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'white' }}>
      <Navbar />
      <ArticleHero article={article} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Progress indicator */}
        <div style={{ position: 'sticky', top: '70px', zIndex: 10, padding: '12px 0', backdropFilter: 'blur(8px)' }}>
          <div style={{
            height: '2px', background: 'rgba(255,255,255,0.06)',
            borderRadius: '1px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: '4%',
              background: `linear-gradient(90deg, ${article.heroAccent}, ${article.heroAccent}88)`,
              borderRadius: '1px',
            }} />
          </div>
        </div>

        {/* Article content */}
        <article>
          {article.sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </article>

        {/* Related */}
        <RelatedArticles articles={related} />

        {/* Bottom nav */}
        <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'center' }}>
          <Link
            href="/tutorials"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none',
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            <ArrowLeft style={{ width: '14px', height: '14px' }} />
            All Tutorials
          </Link>
        </div>
      </div>
    </div>
  )
}
