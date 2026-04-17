// imgbb API upload wrapper
// Get your free API key at https://api.imgbb.com

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY ?? ''

export interface ImgbbResponse {
  success: boolean
  url: string
  error?: string
}

/**
 * Upload an image file to imgbb.
 * Returns the permanent URL on success.
 */
export async function uploadToImgbb(file: File): Promise<ImgbbResponse> {
  if (!IMGBB_API_KEY) {
    return { success: false, url: '', error: 'imgbb API key not configured' }
  }

  try {
    const formData = new FormData()
    formData.append('key', IMGBB_API_KEY)
    formData.append('image', file)

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      return { success: false, url: '', error: `HTTP ${res.status}` }
    }

    const json = await res.json() as {
      success: boolean
      data?: { url: string }
      error?: { message: string }
    }

    if (json.success && json.data?.url) {
      return { success: true, url: json.data.url }
    }

    return { success: false, url: '', error: json.error?.message ?? 'Upload failed' }
  } catch (err) {
    return {
      success: false,
      url: '',
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

/**
 * Convert a File to a base64 data URL for preview purposes.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Validate an image file before upload.
 * Max 8MB (imgbb limit), common image types only.
 */
export function validateImageFile(file: File): string | null {
  const MAX_SIZE = 8 * 1024 * 1024
  const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  if (!ALLOWED.includes(file.type)) {
    return 'Only JPEG, PNG, GIF, or WebP images are allowed'
  }
  if (file.size > MAX_SIZE) {
    return 'Image must be smaller than 8MB'
  }
  return null
}
