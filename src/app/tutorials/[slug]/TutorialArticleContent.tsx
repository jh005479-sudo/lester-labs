'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { ArrowLeft, Clock, BookOpen, ArrowRight, Info, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react'
import { type TutorialArticle, type TutorialSection, getRelatedArticles } from '@/lib/tutorials-content'

// ── Icons ────────────────────────────────────────────────────────────────────

const icons = { info: Info, warning: AlertTriangle, tip: Lightbulb, success: CheckCircle }
const iconColors = { info: '#818cf8', warning: '#fbbf24', tip: '#4ade80', success: '#22d3ee' }
const bgColors = { info: 'rgba(99,102,241,0.08)', warning: 'rgba(245,158,11,0.08)', tip: 'rgba(74,222,128,0.08)', success: 'rgba(34,211,238,0.08)' }
const borderColors = { info: 'rgba(99,102,241,0.2)', warning: 'rgba(245,158,11,0.2)', tip: 'rgba(74,222,128,0.2)', success: 'rgba(34,211,238,0.2)' }

// ── Callout ──────────────────────────────────────────────────────────────────

function Callout({ callout }: { callout: { type: 'info' | 'warning' | 'tip' | 'success'; text: string } }) {
  const cfg = {
    icon: icons[callout.type] ?? Info,
    color: iconColors[callout.type] ?? '#818cf8',
    bg: bgColors[callout.type] ?? 'rgba(99,102,241,0.08)',
    border: borderColors[callout.type] ?? 'rgba(99,102,241,0.2)',
  }
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
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: '#818cf8',
              }}>
                {i + 1}
              </div>
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

// ── Section renderer ─────────────────────────────────────────────────────────

function Section({ section }: { section: TutorialSection }) {
  if (section.type === 'callout' && section.callout) {
    return <Callout callout={section.callout} />
  }
  if (section.type === 'code' && section.code) {
    return <CodeBlock lang={section.code.lang} content={section.code.content} />
  }
  if (section.type === 'step' && section.steps) {
    return <StepList heading={section.heading ?? ''} steps={section.steps} />
  }
  if (section.type === 'image' && section.src) {
    return (
      <figure style={{ margin: '28px 0' }}>
        <div style={{
          width: '100%', aspectRatio: '16/7', borderRadius: '12px', overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={section.src} alt={section.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {section.caption && (
          <figcaption style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
            {section.caption}
          </figcaption>
        )}
      </figure>
    )
  }
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

// ── Related articles ─────────────────────────────────────────────────────────

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
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${article.heroAccent}40` }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: '3px',
                background: `${article.badgeColor}20`, color: article.badgeColor,
                border: `1px solid ${article.badgeColor}40`,
                display: 'inline-block', marginBottom: '8px',
              }}>
                {article.badge}
              </span>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '6px', lineHeight: 1.3 }}>
                {article.title}
              </h4>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                {article.readTime} <ArrowRight style={{ width: '12px', height: '12px', display: 'inline' }} />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Reading progress ─────────────────────────────────────────────────────────

function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement
      const scrollTop = el.scrollTop || document.body.scrollTop
      const scrollHeight = el.scrollHeight - el.clientHeight
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '2px', zIndex: 200,
      background: 'rgba(255,255,255,0.05)',
    }}>
      <div style={{
        height: '100%', background: 'var(--accent)',
        transition: 'width 0.1s linear',
        width: `${progress}%`,
      }} />
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

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
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${article.heroAccent} 1px, transparent 1px), linear-gradient(90deg, ${article.heroAccent} 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '300px', height: '300px', borderRadius: '50%',
        background: `radial-gradient(circle, ${article.heroAccent}18 0%, transparent 70%)`,
      }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 24px 48px', position: 'relative' }}>
        {/* Back */}
        <Link
          href="/tutorials"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
            marginBottom: '32px', transition: 'color 0.2s',
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          All tutorials
        </Link>

        {/* Badge */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: '4px',
            background: `${article.badgeColor}18`, color: article.badgeColor,
            border: `1px solid ${article.badgeColor}40`,
          }}>
            {article.badge}
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, color: 'white',
          marginBottom: '16px', letterSpacing: '-0.02em', lineHeight: 1.15,
        }}>
          {article.title}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '17px', lineHeight: 1.65, color: 'rgba(255,255,255,0.55)',
          marginBottom: '24px', maxWidth: '620px',
        }}>
          {article.subtitle}
        </p>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {article.readTime}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen style={{ width: '12px', height: '12px' }} />
            Tutorial
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main content component ───────────────────────────────────────────────────

export function TutorialArticleContent({ article }: { article: TutorialArticle }) {
  const router = useRouter()
  const related = article.related ? getRelatedArticles(article.related) : []

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'white' }}>
      <Navbar />
      <ReadingProgress />
      <ArticleHero article={article} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {article.sections.map((section, i) => (
            <Section key={i} section={section} />
          ))}
        </div>

        <RelatedArticles articles={related} />
      </div>
    </div>
  )
}
