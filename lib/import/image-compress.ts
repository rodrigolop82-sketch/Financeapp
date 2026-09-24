export const IMAGE_DECODE_ERROR_MESSAGE =
  'No pudimos leer esta imagen. Intenta con una captura de pantalla o foto en JPG/PNG.'

export class ImageDecodeError extends Error {
  readonly code = 'IMAGE_DECODE_FAILED'

  constructor(message: string = IMAGE_DECODE_ERROR_MESSAGE) {
    super(message)
    this.name = 'ImageDecodeError'
  }
}

export interface CompressOptions {
  maxSide?: number
  quality?: number
}

/** Scales (width, height) so the longest side is at most maxSide. Never upscales. */
export function computeTargetSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height }
  const scale = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Some browsers reject the options bag or the format; fall back to <img>.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new ImageDecodeError())
      el.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new ImageDecodeError()
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err instanceof ImageDecodeError ? err : new ImageDecodeError()
  }
}

/**
 * Resizes to maxSide on the longest edge and re-encodes as JPEG. Also converts
 * any format the browser can decode (e.g. HEIC on iOS Safari) to JPEG.
 * Throws ImageDecodeError when the browser can't read the file.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const maxSide = opts.maxSide ?? 1600
  const quality = opts.quality ?? 0.8

  let decoded: Decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new ImageDecodeError()
  }

  try {
    const { width, height } = computeTargetSize(decoded.width, decoded.height, maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageDecodeError()
    // JPEG has no alpha: paint white so transparent PNG screenshots don't turn black.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(decoded.source, 0, 0, width, height)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new ImageDecodeError()
    return blob
  } finally {
    decoded.release()
  }
}
