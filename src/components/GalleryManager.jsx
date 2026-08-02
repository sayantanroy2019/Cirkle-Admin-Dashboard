import { useMemo, useRef, useState } from 'react'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_GALLERY_PHOTOS,
  setGallery,
  uploadEventImage,
} from '../api/events'
import { errorMessage } from '../lib/errors'
import Button from './Button'
import Alert from './Alert'

/**
 * Up to five ordered gallery images.
 *
 * The endpoint is a full replace, so "add one photo" means sending the whole
 * set — including the keys of photos already saved. Both the detail response
 * and the save response carry each photo's `s3Key`, so keeping an existing
 * photo is just echoing its key back.
 *
 * Local edits (add / remove / reorder) are staged and only committed on Save,
 * because every commit rewrites the entire gallery.
 */
export default function GalleryManager({ eventId, gallery, onChange }) {
  const inputRef = useRef(null)

  // [{ key, url }] — `url` may be a presigned remote URL or a local object URL
  // for something just picked.
  const initial = useMemo(
    () =>
      [...(gallery ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((g) => ({ key: g.s3Key, url: g.url })),
    [gallery],
  )

  const [photos, setPhotos] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty =
    photos.length !== initial.length || photos.some((p, i) => p.key !== initial[i]?.key)

  const handlePick = async (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return

    const room = MAX_GALLERY_PHOTOS - photos.length
    if (room <= 0) {
      setError(`A gallery holds at most ${MAX_GALLERY_PHOTOS} images.`)
      return
    }
    const accepted = files.slice(0, room)
    if (accepted.some((f) => !ALLOWED_IMAGE_TYPES.includes(f.type))) {
      setError('Choose JPEG, PNG or WebP images.')
      return
    }

    setError('')
    setSaved(false)
    setBusy(true)
    try {
      // Upload to S3 now; the gallery row is only written on Save.
      const uploaded = []
      for (const file of accepted) {
        const key = await uploadEventImage(eventId, file, 'gallery')
        uploaded.push({ key, url: URL.createObjectURL(file) })
      }
      setPhotos((p) => [...p, ...uploaded])
      if (files.length > room) {
        setError(`Only ${room} more image${room === 1 ? '' : 's'} would fit, so the rest were skipped.`)
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload those images."))
    } finally {
      setBusy(false)
    }
  }

  const move = (from, to) => {
    if (to < 0 || to >= photos.length) return
    setPhotos((p) => {
      const next = [...p]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  const remove = (index) => {
    setPhotos((p) => p.filter((_, i) => i !== index))
    setSaved(false)
  }

  const handleSave = async () => {
    setBusy(true)
    setError('')
    try {
      // Positions are the array order — the endpoint requires 0-4, unique.
      const next = await setGallery(
        eventId,
        photos.map((p, i) => ({ s3Key: p.key, position: i })),
      )
      onChange(next)
      setPhotos(
        [...next]
          .sort((a, b) => a.position - b.position)
          .map((g) => ({ key: g.s3Key, url: g.url })),
      )
      setSaved(true)
    } catch (err) {
      // The backend verifies every key in S3 first and rejects the whole set,
      // leaving the saved gallery untouched — say so, so nobody assumes a
      // partial save happened.
      setError(errorMessage(err, "Couldn't save the gallery."))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setPhotos(initial)
    setError('')
    setSaved(false)
  }

  return (
    <div>
      {error && (
        <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>
          {error}
          {error.includes('not uploaded successfully') && (
            <span className="mt-1 block">
              Nothing was saved — the gallery is unchanged.
            </span>
          )}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-4" onDismiss={() => setSaved(false)}>
          Gallery saved.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {photos.map((p, i) => (
          <div
            key={p.key ?? i}
            className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          >
            <img src={p.url} alt={`Gallery image ${i + 1}`} className="size-full object-cover" />
            <span className="absolute top-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {i + 1}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0 || busy}
                aria-label={`Move image ${i + 1} earlier`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={busy}
                aria-label={`Remove image ${i + 1}`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === photos.length - 1 || busy}
                aria-label={`Move image ${i + 1} later`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        ))}

        {photos.length < MAX_GALLERY_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-500 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-xs">Add</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        multiple
        onChange={handlePick}
        className="hidden"
      />

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} loading={busy} disabled={!dirty}>
          {busy ? 'Saving…' : 'Save gallery'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={handleReset} disabled={busy}>
            Discard changes
          </Button>
        )}
        <p className="text-xs text-gray-500">
          {photos.length}/{MAX_GALLERY_PHOTOS} · saving replaces the whole gallery
        </p>
      </div>
    </div>
  )
}
