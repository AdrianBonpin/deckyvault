import sharp from "sharp"

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const QUALITY_HIGH = 80
const QUALITY_FLOOR = 75
const MAX_SIZE_BYTES = 400 * 1024 // 400 KB
const FALLBACK_WIDTH = 1280
const FALLBACK_HEIGHT = 720

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

// Magic byte signatures for file type validation
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header (WEBP container)
}

export function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const expected = MAGIC_BYTES[declaredMime]
  if (!expected) return false
  if (buffer.length < expected.length) return false
  return expected.every((byte, i) => buffer[i] === byte)
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  mimeType: string // Always "image/jpeg" after processing
  size: number
}

/**
 * Process a screenshot for storage:
 * 1. Validate format via magic bytes
 * 2. Resize to max 1920×1080, maintain aspect ratio
 * 3. Convert to progressive JPEG
 * 4. If size > 400KB, reduce quality to 75
 * 5. If still > 400KB at quality 75, resize to 1280×720 and try again
 * 6. Strip ALL EXIF data
 */
export async function processScreenshot(
  inputBuffer: Buffer,
  declaredMime: string,
): Promise<ProcessedImage> {
  if (!isAllowedMimeType(declaredMime)) {
    throw new Error(`Invalid MIME type: ${declaredMime}`)
  }

  if (!validateMagicBytes(inputBuffer, declaredMime)) {
    throw new Error("File content does not match declared type")
  }

  let pipeline = sharp(inputBuffer, { animated: false })
    .rotate() // Auto-rotate based on EXIF orientation
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY_HIGH, progressive: true, mozjpeg: true })
    // Metadata is stripped by default (no .withMetadata() / .keepMetadata() call)

  let outputBuffer = await pipeline.toBuffer()
  let metadata = await sharp(outputBuffer).metadata()

  // If still over 400KB, reduce quality to floor
  if (outputBuffer.length > MAX_SIZE_BYTES) {
    pipeline = sharp(inputBuffer, { animated: false })
      .rotate()
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY_FLOOR, progressive: true, mozjpeg: true })

    outputBuffer = await pipeline.toBuffer()
    metadata = await sharp(outputBuffer).metadata()
  }

  // If STILL over 400KB, downscale to 1280×720
  if (outputBuffer.length > MAX_SIZE_BYTES) {
    pipeline = sharp(inputBuffer, { animated: false })
      .rotate()
      .resize(FALLBACK_WIDTH, FALLBACK_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITY_FLOOR, progressive: true, mozjpeg: true })

    outputBuffer = await pipeline.toBuffer()
    metadata = await sharp(outputBuffer).metadata()
  }

  return {
    buffer: outputBuffer,
    width: metadata.width ?? FALLBACK_WIDTH,
    height: metadata.height ?? FALLBACK_HEIGHT,
    mimeType: "image/jpeg",
    size: outputBuffer.length,
  }
}