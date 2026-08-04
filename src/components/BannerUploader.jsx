import { useEffect, useRef, useState } from 'react'
import { setBanner, uploadEventImage } from '../api/events'
import { errorMessage } from '../lib/errors'
import { BANNER_CROP, FILE_ACCEPT } from '../lib/crop'
import useCropQueue from '../hooks/useCropQueue'
import Button from './Button'
import Alert from './Alert'
import RemoteImage from './RemoteImage'
import PhotoCropper from './PhotoCropper'
import PreparingOverlay from './PreparingOverlay'
import Spinner from './Spinner'

/**
 * Single 16:9 banner slot on the crop pipeline.
 *
 * pick → decode (HEIC too) → crop to 16:9 → WebP export → upload to S3 →
 * "Save banner" attaches the key. The upload runs on crop-confirm so progress
 * is visible immediately; the key is only attached on save, and save is blocked
 * while the upload is in flight or errored.
 *
 * There is no endpoint to clear a banner, only to replace it — hence "Replace",
 * never "Remove".
 */
export default function BannerUploader({ eventId, bannerUrl, onChange }) {
  const inputRef = useRef(null)
  const crop = useCropQueue()

  // The staged, already-cropped upload: { file, key, previewUrl, status, progress, error }
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Revoke the staged preview URL on unmount / replacement. Only ours — the
  // server-provided presigned bannerUrl must never be revoked.
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  useEffect(
    () => () => {
      if (pendingRef.current?.previewUrl) URL.revokeObjectURL(pendingRef.current.previewUrl)
    },
    [],
  )

  const runUpload = async (file) => {
    setPending((p) => ({ ...p, file, status: 'uploading', progress: 0, error: '' }))
    try {
      const { key, previewUrl } = await uploadEventImage(eventId, file, 'banner', (progress) =>
        setPending((p) => (p ? { ...p, progress } : p)),
      )
      setPending((p) => (p ? { ...p, key, previewUrl, status: 'done' } : p))
    } catch (err) {
      // Retry reuses this same cropped File — a failed upload must not send the
      // admin back through the crop tool.
      setPending((p) => (p ? { ...p, status: 'error', error: errorMessage(err, 'Upload failed.') } : p))
    }
  }

  const handleCropConfirm = (croppedFile) => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    setPending({ file: croppedFile, key: null, previewUrl: null, status: 'uploading', progress: 0, error: '' })
    setTimeout(() => runUpload(croppedFile), 0)
    crop.advance()
  }

  const handleSave = async () => {
    if (!pending?.key) return
    setSaving(true)
    setError('')
    try {
      // The backend HeadObjects the key here, so this fails if S3 didn't get it.
      onChange(await setBanner(eventId, pending.key))
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl)
      setPending(null)
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the banner."))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    setPending(null)
    setError('')
  }

  const shownUrl = pending?.previewUrl ?? bannerUrl
  const busy = pending?.status === 'uploading' || saving

  return (
    <div>
      {(error || crop.error) && (
        <Alert tone="error" className="mb-4" onDismiss={() => { setError(''); crop.setError('') }}>
          {error || crop.error}
        </Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-video w-full max-w-sm shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {shownUrl ? (
            <RemoteImage
              src={shownUrl}
              alt="Event banner"
              className="size-full object-cover"
              fallbackLabel="Banner unavailable"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-gray-400">
              No banner yet
            </div>
          )}

          {pending?.status === 'uploading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85">
              <div className="h-1 w-2/3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-brand transition-[width]"
                  style={{ width: `${pending.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">Uploading… {pending.progress}%</span>
            </div>
          )}

          {pending?.status === 'error' && (
            <button
              type="button"
              onClick={() => runUpload(pending.file)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/90 px-3 text-center"
            >
              <span className="text-sm font-medium text-brand">Retry</span>
              <span className="text-xs text-red-600">{pending.error}</span>
            </button>
          )}
        </div>

        <div className="sm:pt-1">
          <input
            ref={inputRef}
            type="file"
            accept={FILE_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) crop.enqueue([file])
            }}
            className="hidden"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
              {bannerUrl || pending ? 'Replace banner' : 'Upload banner'}
            </Button>
            {pending && (
              <>
                <Button loading={saving} disabled={pending.status !== 'done'} onClick={handleSave}>
                  {saving ? 'Saving…' : 'Save banner'}
                </Button>
                <Button variant="secondary" disabled={saving} onClick={discard}>
                  Discard
                </Button>
              </>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            JPEG, PNG, WebP or HEIC. Cropped to 16:9 and saved as WebP.
          </p>
          {pending?.status === 'done' && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              Cropped and uploaded — save to apply it.
            </p>
          )}
          {pending?.status === 'uploading' && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              <Spinner className="size-3" />
              Uploading…
            </p>
          )}
        </div>
      </div>

      {crop.preparing && !crop.cropSrc && <PreparingOverlay />}

      {crop.cropSrc && (
        <PhotoCropper
          imageSrc={crop.cropSrc}
          aspect={BANNER_CROP.aspect}
          maxLong={BANNER_CROP.maxLong}
          quality={BANNER_CROP.quality}
          title="Position the banner (16:9)"
          onConfirm={handleCropConfirm}
          onCancel={crop.advance}
        />
      )}
    </div>
  )
}
