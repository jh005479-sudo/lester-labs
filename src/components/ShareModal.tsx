'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { StatCardSVG, renderStatCardToBlob, type StatCardProps } from '@/lib/stat-cards'
import { X, Twitter, Copy, Download, Share2, Code, Check } from 'lucide-react'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  stats: StatCardProps
}

export function ShareModal({ open, onClose, stats }: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const getBlob = useCallback(() => renderStatCardToBlob(stats), [stats])

  const handlePostToX = async () => {
    const text = `LitVM Network Stats\n\nBlock: #${stats.blockHeight.toLocaleString()}\n24h Txs: ${stats.txCount24h.toLocaleString()}\n\nhttps://lester-labs-psi.vercel.app/explorer\n\n#LitVM #Litecoin #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleCopyImage = async () => {
    try {
      const blob = await getBlob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied('image')
      setTimeout(() => setCopied(null), 2000)
    } catch (e) {
      console.error('Copy image failed', e)
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await getBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `litvm-stats-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed', e)
    }
  }

  const handleNativeShare = async () => {
    try {
      const blob = await getBlob()
      const file = new File([blob], 'litvm-stats.png', { type: 'image/png' })
      if (navigator.share) {
        await navigator.share({
          title: 'LitVM Network Stats',
          text: `Block #${stats.blockHeight.toLocaleString()} — ${stats.txCount24h.toLocaleString()} txs in 24h`,
          files: [file],
        })
      }
    } catch (e) {
      console.error('Share failed', e)
    }
  }

  const handleCopyEmbed = () => {
    const embed = `<iframe src="https://lester-labs-psi.vercel.app/embed/stats" width="600" height="315" frameborder="0"></iframe>`
    navigator.clipboard.writeText(embed)
    setCopied('embed')
    setTimeout(() => setCopied(null), 2000)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const shareOptions = [
    { icon: Twitter, label: 'Post to X', action: handlePostToX, color: 'text-sky-400' },
    { icon: copied === 'image' ? Check : Copy, label: copied === 'image' ? 'Copied!' : 'Copy Image', action: handleCopyImage, color: 'text-white' },
    { icon: Download, label: 'Download PNG', action: handleDownload, color: 'text-white' },
    { icon: Share2, label: 'Share', action: handleNativeShare, color: 'text-white' },
    { icon: copied === 'embed' ? Check : Code, label: copied === 'embed' ? 'Copied!' : 'Copy Embed', action: handleCopyEmbed, color: 'text-white' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Share Network Stats</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Card preview - scaled down */}
        <div className="overflow-hidden rounded-lg border border-white/10 mb-5" style={{ maxHeight: '320px' }}>
          <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '630px' }}>
            <StatCardSVG {...stats} />
          </div>
        </div>

        {/* Share options */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {shareOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={opt.action}
              className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <opt.icon className={`h-5 w-5 ${opt.color}`} />
              <span className="text-xs">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
