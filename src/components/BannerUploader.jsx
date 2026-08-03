import { useRef, useState } from 'react'
import { ALLOWED_IMAGE_TYPES, setBanner, uploadEventImage } from '../api/events'
import { errorMessage } from '../lib/errors'
import Button from './Button'
import RemoteImage from './RemoteImage'
import Alert from './Alert'

/**
 * Single-slot banner. Pick → presign → PUT to S3 → attach the key.
 *
 * There's no endpoint to clear a banner, only to replace it, so this offers
 * "Replace" and never "Remove".
 */
export default function BannerUploader({ eventId, bannerUrl, onChange }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const handlePick = async (event) => {
    const file = event.target.files?.[0]
    // Let the same file be picked again after a failure.
    event.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.')
      return
    }

    setError('')
    setBusy(true)
    setProgress(0)
    try {
      const key = await uploadEventImage(eventId, file, 'banner', setProgress)
      // The backend HeadObjects the key here, so this fails if S3 didn't get it.
      onChange(await setBanner(eventId, key))
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the banner."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && (
        <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-video w-full max-w-xs shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {bannerUrl ? (
            <RemoteImage
              src={bannerUrl}
              alt="Event banner"
              className="size-full object-cover"
              fallbackLabel="Banner unavailable"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-gray-400">
              No banner yet
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85">
              <div className="h-1 w-2/3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-brand transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-600">Uploading… {progress}%</span>
            </div>
          )}
        </div>

        <div className="sm:pt-1">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            onChange={handlePick}
            className="hidden"
          />
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {bannerUrl ? 'Replace banner' : 'Upload banner'}
          </Button>
          <p className="mt-2 text-xs text-gray-500">JPEG, PNG or WebP.</p>
        </div>
      </div>
    </div>
  )
}
