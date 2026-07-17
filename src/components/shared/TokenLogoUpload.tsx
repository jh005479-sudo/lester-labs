'use client'

import { useState, useRef, useCallback, useId } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { fileToDataUrl, validateImageFile } from '@/lib/imgbb'
import { deleteTokenImageUrl, setTokenImageUrl } from '@/lib/tokenImageStore'

interface TokenLogoUploadProps {
  tokenAddress?: string // if provided, saves URL to IndexedDB on deploy
  onUrlChange?: (url: string) => void
  currentUrl?: string | null
}

type UploadState = 'idle' | 'done' | 'error'

export function TokenLogoUpload({
  tokenAddress,
  onUrlChange,
  currentUrl,
}: TokenLogoUploadProps) {
  const [state, setState] = useState<UploadState>(
    currentUrl ? 'done' : 'idle',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    const validationError = await validateImageFile(file)
    if (validationError) {
      setError(validationError)
      setState('error')
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      setPreviewUrl(dataUrl)
      setState('done')
      onUrlChange?.(dataUrl)

      if (tokenAddress) {
        await setTokenImageUrl(tokenAddress, dataUrl)
      }
    } catch {
      setError('Logo could not be saved locally')
      setState('error')
    }
  }, [tokenAddress, onUrlChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    setError(null)
    setState('idle')
    onUrlChange?.('')
    if (inputRef.current) inputRef.current.value = ''
    if (tokenAddress) {
      void deleteTokenImageUrl(tokenAddress).catch(() => {
        setError('Logo was removed from this view but could not be removed from browser storage')
      })
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-white/80">
        Token Logo
        <span className="ml-1.5 text-xs font-normal text-white/30">
          (optional)
        </span>
      </label>

      {/* Preview / upload area */}
      {state === 'idle' || state === 'error' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Choose a token logo image"
          className={`
            group relative flex h-28 cursor-pointer flex-col items-center justify-center
            rounded-xl border-2 border-dashed border-white/10
            bg-white/[0.02] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/[0.04]
            transition-all duration-200
            ${isDragging ? 'border-[var(--accent)] bg-[var(--accent)]/[0.06]' : ''}
            ${state === 'error' ? 'border-red-500/50' : ''}
          `}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose a token logo image"
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-white/60 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              {isDragging ? <Upload size={18} /> : <ImageIcon size={18} />}
            </div>
            <div className="text-xs text-center leading-relaxed px-4">
              <span className="font-medium text-[var(--accent)] group-hover:underline">
                Click to upload
              </span>
              {' '}or drag and drop
              <br />
              JPEG, PNG, WebP · max 1MB · 32–2048px
            </div>
          </div>
        </div>
      ) : (
        /* Locally persisted preview */
        <div className="relative flex h-28 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {/* Image preview */}
          {/* Data URLs are already local and cannot benefit from Next Image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl ?? undefined}
            alt="Token logo preview"
            className="h-full w-full object-cover"
          />

          {/* Overlay on hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Upload size={12} />
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/20 transition-colors"
            >
              <X size={12} />
              Remove
            </button>
          </div>

          {/* Done badge */}
          {state === 'done' && (
            <div className="absolute top-2 right-2 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              Saved locally
            </div>
          )}

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Choose a token logo image"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <X size={12} />
          {error}
          {state === 'error' && (
            <button
              type="button"
              onClick={handleRemove}
              className="ml-auto underline hover:no-underline"
            >
              Dismiss
            </button>
          )}
        </p>
      )}

      <p className="text-xs text-white/30">Stored only in this browser; no account key or remote upload is used.</p>
    </div>
  )
}
