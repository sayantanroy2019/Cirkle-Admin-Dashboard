// Crop pipeline helpers, ported from the consumer app (src/lib/crop.js).
//
// The crop step is the universal normalizer: any picked file →
// (HEIC decode if needed) → crop to a fixed ratio → WebP export → upload.
// Everything downstream can assume WebP at a known aspect ratio, because
// nothing else can get through.
//
// Kept near-verbatim on purpose — the HEIC handling below encodes fixes that
// are easy to lose in a rewrite. See the comments on each branch.

const CROPPABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Three-step detection, deliberately not a filename check.
 *
 * iOS and some browsers transcode HEIC→JPEG on selection but keep the .heic
 * filename, so trusting the extension alone would re-convert an already-JPEG
 * file and corrupt it.
 */
function isHeic(file) {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  // Explicit HEIC MIME → definitely HEIC.
  if (type === 'image/heic' || type === 'image/heif') return true
  // A known-good image MIME → trust it, even if the filename still says .heic.
  if (CROPPABLE_TYPES.includes(type)) return false
  // Unknown / empty MIME → fall back to the extension.
  return name.endsWith('.heic') || name.endsWith('.heif')
}

/**
 * Browsers can't draw HEIC to a canvas, so decode it to JPEG *before* cropping
 * — both the crop surface and the canvas export fail on a raw HEIC.
 * JPEG/PNG/WebP pass through untouched. Returns a canvas-drawable Blob/File.
 */
export async function decodeForCrop(file) {
  if (isHeic(file)) {
    // Dynamic import only: heic2any is ~1.3MB minified, and a static import
    // would put it in the main bundle for every admin page load.
    const { default: heic2any } = await import('heic2any')
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    return Array.isArray(out) ? out[0] : out
  }
  if (!CROPPABLE_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP and HEIC images are allowed.')
  }
  return file
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read this image.'))
    img.src = src
  })
}

/**
 * Render the chosen crop region to a canvas and export a WebP File, capped to
 * `maxLong` on the long edge. Never upscales — a crop region smaller than the
 * cap exports at its native size.
 */
export async function getCroppedWebp(imageSrc, cropPixels, { maxLong = 1080, quality = 0.8 } = {}) {
  const image = await loadImage(imageSrc)
  const { x, y, width, height } = cropPixels

  const longEdge = Math.max(width, height)
  const scale = longEdge > maxLong ? maxLong / longEdge : 1
  const outW = Math.round(width * scale)
  const outH = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, x, y, width, height, 0, 0, outW, outH)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob) throw new Error('Could not process this image.')
  return new File([blob], `image-${Date.now()}.webp`, { type: 'image/webp' })
}

/* Export settings per image kind. The banner gets a larger cap than the gallery
   because it renders as a full-width hero — 1080 across a 16:9 frame is only
   1080×608 and visibly soft on a desktop viewport. */
export const BANNER_CROP = { aspect: 16 / 9, maxLong: 1920, quality: 0.8 }
export const GALLERY_CROP = { aspect: 1, maxLong: 1080, quality: 0.8 }

/* Artist photos are square because the consumer renders them as a 72px circle
   with object-cover (see ArtistAvatar.jsx in the consumer app). 720 is ~10x the
   display size, ample even at 3x DPR — raise it here if artists ever get a
   larger surface. */
export const ARTIST_CROP = { aspect: 1, maxLong: 720, quality: 0.8 }

/** iPhone users can't select their own photos unless HEIC is in `accept`. */
export const FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
