const MAX_IMAGE_BYTES = 1024 * 1024
const MIN_IMAGE_DIMENSION = 32
const MAX_IMAGE_DIMENSION = 2048
const MAX_IMAGE_PIXELS = 4_000_000

export const TOKEN_LOGO_LIMITS = {
  maxBytes: MAX_IMAGE_BYTES,
  minDimension: MIN_IMAGE_DIMENSION,
  maxDimension: MAX_IMAGE_DIMENSION,
  maxPixels: MAX_IMAGE_PIXELS,
} as const

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export interface ImageMetadata {
  type: string
  size: number
}

export interface ImageDimensions {
  width: number
  height: number
}

export function validateImageMetadata({ type, size }: ImageMetadata): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType)) {
    return 'Only JPEG, PNG, or WebP images are allowed'
  }
  if (size <= 0) {
    return 'Image file is empty'
  }
  if (size > MAX_IMAGE_BYTES) {
    return 'Image must be 1MB or smaller'
  }
  return null
}

export function hasValidImageSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (type === 'image/png') {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)
  }
  if (type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  return false
}

export function validateImageDimensions({ width, height }: ImageDimensions): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return 'Image dimensions could not be verified'
  }
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return `Image must be at least ${MIN_IMAGE_DIMENSION} by ${MIN_IMAGE_DIMENSION} pixels`
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    return `Image dimensions must not exceed ${MAX_IMAGE_DIMENSION} by ${MAX_IMAGE_DIMENSION} pixels`
  }
  return null
}

async function readImageDimensions(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close()
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image could not be decoded'))
    }
    image.src = objectUrl
  })
}

export async function validateImageFile(file: File): Promise<string | null> {
  const metadataError = validateImageMetadata(file)
  if (metadataError) return metadataError

  try {
    const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    if (!hasValidImageSignature(file.type, signature)) {
      return 'Image contents do not match the selected file type'
    }

    return validateImageDimensions(await readImageDimensions(file))
  } catch {
    return 'Image could not be decoded safely'
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Image could not be read'))
    reader.readAsDataURL(file)
  })
}
