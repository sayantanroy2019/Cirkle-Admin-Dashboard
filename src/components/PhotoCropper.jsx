import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedWebp } from '../lib/crop'

/**
 * Full-screen crop tool, ported from the consumer app. The frame is locked to
 * whatever ratio the caller passes, so the exported WebP always matches the
 * target shape — 16:9 for banners, 1:1 for gallery images.
 *
 * `restrictPosition` keeps the image from being dragged out of the frame, and
 * `objectFit="contain"` means the whole source stays reachable at minZoom.
 */
export default function PhotoCropper({
  imageSrc,
  aspect,
  maxLong,
  quality,
  title = 'Position your image',
  onConfirm,
  onCancel,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')

  const onCropComplete = useCallback((_area, pixels) => setCroppedAreaPixels(pixels), [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels || isExporting) return
    setIsExporting(true)
    setError('')
    try {
      // The canvas export on a large image is not instant, hence the
      // "Processing…" state rather than an apparently-dead button.
      onConfirm(await getCroppedWebp(imageSrc, croppedAreaPixels, { maxLong, quality }))
    } catch (err) {
      setError(err.message || 'Could not process this image.')
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          minZoom={1}
          maxZoom={4}
          restrictPosition
          objectFit="contain"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      <div className="shrink-0 px-6 pt-4">
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-brand"
          aria-label="Zoom"
        />
      </div>

      <div aria-live="polite" className="min-h-5 px-6 pt-2 text-center">
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-3 px-6 py-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isExporting}
          className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!croppedAreaPixels || isExporting}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
        >
          {isExporting ? 'Processing…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
