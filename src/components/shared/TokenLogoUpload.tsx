'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { uploadToImgbb, fileToDataUrl, validateImageFile } from '@/lib/imgbb'
import { setTokenImageUrl } from '@/lib/tokenImageStore'

interface TokenLogoUploadProps {
  tokenAddress?: string // if provided, saves URL to IndexedDB on deploy
  onUrlChange?: (url: string) => void
  currentUrl?: string | null
}

type UploadState = 'idle' | 'preview' | 'uploading' | 'done' | 'error'

export function TokenLogoUpload({
  tokenAddress,
  onUrlChange,
  currentUrl,
}: TokenLogoUploadProps) {
  const [state, setState] = useState<UploadState>(
    currentUrl ? 'done' : 'idle',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null)
  const [finalUrl, setFinalUrl] = useState<string | null>(currentUrl ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // Show local preview immediately
    const dataUrl = await fileToDataUrl(file)
    setPreviewUrl(dataUrl)
    setState('preview')

    // Upload to imgbb
    setState('uploading')
    const result = await uploadToImgbb(file)

    if (result.success && result.url) {
      setFinalUrl(result.url)
      setState('done')
      onUrlChange?.(result.url)

      // Persist to IndexedDB if token address is available
      if (tokenAddress) {
        await setTokenImageUrl(tokenAddress, result.url)
      }
    } else {
      setError(result.error ?? 'Upload failed')
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
    setFinalUrl(null)
    setError(null)
    setState('idle')
    onUrlChange?.('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const isLoading = state === 'uploading'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/80">
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
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
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
              JPEG, PNG, GIF, WebP · max 8MB
            </div>
          </div>
        </div>
      ) : state === 'uploading' ? (
        <div className="flex h-28 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)]" />
            <span className="text-xs text-white/40">Uploading…</span>
          </div>
        </div>
      ) : (
        /* Preview state (preview | done | error with preview) */
        <div className="relative flex h-28 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          {/* Image preview */}
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
              ✓ Uploaded
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
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

      {/* imgbb not configured notice */}
      {state === 'idle' && !process.env.NEXT_PUBLIC_IMGBB_API_KEY && (
        <p className="text-xs text-white/20">
          Logo upload available after adding NEXT_PUBLIC_IMGBB_API_KEY
        </p>
      )}
    </div>
  )
}
