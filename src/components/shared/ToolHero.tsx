'use client'

import { useEffect, useRef } from 'react'

interface StatPill {
  label: string
  value: string
}

interface ToolHeroProps {
  category: string
  title: string
  titleHighlight?: string
  subtitle: string
  color: string           // hex e.g. "#6B4FFF"
  stats: StatPill[]
  image?: string          // e.g. "/images/carousel/token-factory.png"
  compact?: boolean
  subtitleMaxWidth?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function ToolHero({ category, title, titleHighlight, subtitle, color, stats, image, compact = false, subtitleMaxWidth = '420px' }: ToolHeroProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [r, g, b] = hexToRgb(color)
  const bg = '#0a0818'

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    setTimeout(() => {
      el.querySelectorAll('.reveal, .title-reveal, .sub-reveal, .reveal-scale').forEach((node) => {
        node.classList.add('visible')
      })
    }, 80)
  }, [])

  const baseName = titleHighlight ? title : ''

  return (
    <div
      ref={headerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: bg,
      }}
    >
      {/* Illustration — fades in from the right */}
      {image && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0,
          width: '52%',
          zIndex: 0,
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 30%',
              display: 'block',
              opacity: 0.55,
            }}
          />
          {/* Fade left edge into bg */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to right, ${bg} 0%, rgba(10,8,24,0.7) 30%, rgba(10,8,24,0.2) 65%, transparent 100%)`,
          }} />
          {/* Fade bottom edge */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to top, ${bg} 0%, transparent 40%)`,
          }} />
          {/* Fade top edge */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, ${bg} 0%, transparent 25%)`,
          }} />
          {/* Accent color tint overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 70% 50%, rgba(${r},${g},${b},0.08) 0%, transparent 70%)`,
          }} />
        </div>
      )}

      {/* Ambient glow behind text */}
      <div style={{
        position: 'absolute',
        top: '-80px', left: '20%',
        width: '600px', height: '500px',
        background: `radial-gradient(ellipse, rgba(${r},${g},${b},0.1) 0%, rgba(${r},${g},${b},0.03) 50%, transparent 70%)`,
        filter: 'blur(50px)',
        pointerEvents: 'none', zIndex: 0,
      }} />


      {/* Floating particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        {[
          { left: '8%',  top: '25%', delay: '0s',   dur: '3.5s', size: '3px' },
          { left: '18%', top: '70%', delay: '1.5s',  dur: '3.8s', size: '2px' },
          { left: '45%', top: '15%', delay: '0.4s',  dur: '3.2s', size: '4px' },
          { left: '5%',  top: '50%', delay: '2.2s',  dur: '4.5s', size: '2px' },
          { left: '30%', top: '80%', delay: '1.8s',  dur: '3.6s', size: '3px' },
        ].map((p, i) => (
          <span key={i} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: color,
            left: p.left, top: p.top,
            opacity: 0,
            animation: `particleFloat ${p.dur} ease-in-out ${p.delay} infinite`,
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        maxWidth: '1280px',
        margin: '0 auto',
        padding: compact
          ? 'clamp(98px,9vw,124px) clamp(16px,4vw,40px) clamp(38px,4vw,54px)'
          : 'clamp(120px,11vw,150px) clamp(16px,4vw,40px) clamp(64px,7vw,90px)',
      }}>
        <div style={{ maxWidth: '560px' }}>

          {/* Category chip */}
          <div className="reveal" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '5px 14px',
            background: `rgba(${r},${g},${b},0.1)`,
            border: `1px solid rgba(${r},${g},${b},0.25)`,
            borderRadius: '20px',
            fontSize: '11px', color: color,
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
            marginBottom: '22px',
          }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}`,
              animation: 'toolDotPulse 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            {category}
          </div>

          {/* Title */}
          <h1 className="title-reveal" style={{
            fontSize: 'clamp(44px, 6vw, 70px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            marginBottom: '18px',
            fontFamily: 'Sora, sans-serif',
          }}>
            {titleHighlight ? (
              <>
                <span className="word" style={{ color: '#F0EEF5' }}>{baseName} </span>
                <span
                  className="word highlight"
                  style={{
                    background: `linear-gradient(135deg, #fff 0%, ${color} 50%, rgba(${r},${g},${b},0.8) 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {titleHighlight}
                </span>
              </>
            ) : (
              <span
                className="word highlight"
                style={{
                  background: `linear-gradient(135deg, #fff 0%, #e8e4ff 30%, ${color} 65%, rgba(${r},${g},${b},0.8) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {title}
              </span>
            )}
          </h1>

          {/* Subtitle */}
          <p className="sub-reveal" style={{
            fontSize: '16px',
            color: 'rgba(240,238,245,0.5)',
            maxWidth: subtitleMaxWidth,
            lineHeight: 1.7,
            marginBottom: '32px',
          }}>
            {subtitle}
          </p>

          {/* Stat row */}
          <div className="reveal reveal-delay-1" style={{
            display: 'flex', gap: '28px', flexWrap: 'wrap',
          }}>
            {stats.map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                  color: 'rgba(240,238,245,0.28)',
                }}>
                  {label}
                </span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#F0EEF5' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
