import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_GALLERY_PHOTOS, setGallery, uploadEventImage } from '../api/events'
import { errorMessage } from '../lib/errors'
import { FILE_ACCEPT, GALLERY_CROP } from '../lib/crop'
import useCropQueue from '../hooks/useCropQueue'
import Button from './Button'
import Alert from './Alert'
import RemoteImage from './RemoteImage'
import PhotoCropper from './PhotoCropper'
import PreparingOverlay from './PreparingOverlay'

/**
 * Up to five ordered 1:1 gallery images on the crop pipeline.
 *
 * pick (multi-select allowed) → each file decoded and cropped **one at a
 * time** → WebP → uploaded immediately so each slot shows its own progress →
 * "Save gallery" attaches the whole set.
 *
 * The save is replace-all and all-or-nothing: the backend HeadObjects every key
 * and rejects the entire request if one is missing, leaving the saved gallery
 * untouched. So save is blocked until every slot has finished uploading — the
 * rejection should never be reachable through the UI.
 *
 * Existing photos arrive with their `s3Key`, so keeping one across a save is
 * just echoing its key back.
 *
 * Slot: { uid, key, previewUrl, status, progress, error, file, isObjectUrl }
 */
const fromApi = (gallery) =>
  [...(gallery ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      uid: g.s3Key,
      key: g.s3Key,
      previewUrl: g.url,
      status: 'done',
      progress: 100,
      error: '',
      file: null,
      // Server-provided presigned URL — must never be revoked.
      isObjectUrl: false,
    }))

export default function GalleryManager({ eventId, gallery, onChange }) {
  const initial = useMemo(() => fromApi(gallery), [gallery])

  const [rows, setRows] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef(null)
  const crop = useCropQueue()

  // Revoke only the object URLs we created, on unmount.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  useEffect(
    () => () =>
      rowsRef.current.forEach((r) => r.isObjectUrl && r.previewUrl && URL.revokeObjectURL(r.previewUrl)),
    [],
  )

  const patch = (uid, fields) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...fields } : r)))

  const runUpload = async (uid, file) => {
    patch(uid, { status: 'uploading', progress: 0, error: '' })
    try {
      const { key, previewUrl } = await uploadEventImage(eventId, file, 'gallery', (progress) =>
        patch(uid, { progress }),
      )
      patch(uid, { key, previewUrl, status: 'done', isObjectUrl: true })
    } catch (err) {
      // Keeps `file` on the slot so Retry doesn't re-open the crop tool.
      patch(uid, { status: 'error', error: errorMessage(err, 'Upload failed.') })
    }
  }

  const handleFiles = (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    const room = MAX_GALLERY_PHOTOS - rows.length
    if (room <= 0) {
      setError(`A gallery holds at most ${MAX_GALLERY_PHOTOS} images.`)
      return
    }
    setSaved(false)
    crop.enqueue(files.slice(0, room))
    if (files.length > room) {
      setError(`Only ${room} more image${room === 1 ? '' : 's'} would fit, so the rest were skipped.`)
    }
  }

  const handleCropConfirm = (croppedFile) => {
    const uid = crypto.randomUUID()
    setRows((prev) => [
      ...prev,
      { uid, key: null, previewUrl: null, status: 'uploading', progress: 0, error: '', file: croppedFile, isObjectUrl: false },
    ])
    setTimeout(() => runUpload(uid, croppedFile), 0)
    setSaved(false)
    crop.advance()
  }

  const move = (from, to) => {
    if (to < 0 || to >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  const remove = (uid) => {
    setRows((prev) => {
      const target = prev.find((r) => r.uid === uid)
      if (target?.isObjectUrl && target.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((r) => r.uid !== uid)
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const next = await setGallery(
        eventId,
        rows.map((r, i) => ({ s3Key: r.key, position: i })),
      )
      onChange(next)
      // Swap staged object URLs for the server's presigned ones.
      rows.forEach((r) => r.isObjectUrl && r.previewUrl && URL.revokeObjectURL(r.previewUrl))
      setRows(fromApi(next))
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the gallery."))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    rows.forEach((r) => r.isObjectUrl && r.previewUrl && URL.revokeObjectURL(r.previewUrl))
    setRows(initial)
    setError('')
    setSaved(false)
  }

  const uploading = rows.some((r) => r.status === 'uploading')
  const failed = rows.some((r) => r.status === 'error')
  const dirty =
    rows.length !== initial.length || rows.some((r, i) => r.key !== initial[i]?.key)
  const atCap = rows.length >= MAX_GALLERY_PHOTOS

  return (
    <div>
      {(error || crop.error) && (
        <Alert tone="error" className="mb-4" onDismiss={() => { setError(''); crop.setError('') }}>
          {error || crop.error}
          {(error || '').includes('not uploaded successfully') && (
            <span className="mt-1 block">Nothing was saved — the gallery is unchanged.</span>
          )}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-4" onDismiss={() => setSaved(false)}>
          Gallery saved.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {rows.map((row, i) => (
          <div
            key={row.uid}
            className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          >
            {row.previewUrl && row.status === 'done' && (
              <RemoteImage
                src={row.previewUrl}
                alt={`Gallery image ${i + 1}`}
                className="size-full object-cover"
              />
            )}

            {row.status === 'uploading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 px-2">
                <div className="h-1 w-2/3 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full bg-brand transition-[width]" style={{ width: `${row.progress}%` }} />
                </div>
                <span className="text-[11px] text-gray-600">{row.progress}%</span>
              </div>
            )}

            {row.status === 'error' && (
              <button
                type="button"
                onClick={() => runUpload(row.uid, row.file)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/90 px-2 text-center"
              >
                <span className="text-xs font-medium text-brand">Retry</span>
                <span className="text-[10px] text-red-600">{row.error}</span>
              </button>
            )}

            <span className="absolute top-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {i + 1}
            </span>

            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0 || saving}
                aria-label={`Move image ${i + 1} earlier`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => remove(row.uid)}
                disabled={saving}
                aria-label={`Remove image ${i + 1}`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === rows.length - 1 || saving}
                aria-label={`Move image ${i + 1} later`}
                className="px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        ))}

        {!atCap && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={saving}
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
        accept={FILE_ACCEPT}
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} loading={saving} disabled={!dirty || uploading || failed}>
          {saving ? 'Saving…' : 'Save gallery'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={discard} disabled={saving}>
            Discard changes
          </Button>
        )}
        <p className="text-xs text-gray-500">
          {rows.length}/{MAX_GALLERY_PHOTOS} · cropped to 1:1 · saving replaces the whole gallery
        </p>
      </div>

      {(uploading || failed) && (
        <p className="mt-2 text-xs text-gray-500">
          {uploading
            ? 'Waiting for uploads to finish before the gallery can be saved.'
            : 'Retry the failed upload before saving — the gallery saves all-or-nothing.'}
        </p>
      )}

      {crop.preparing && !crop.cropSrc && <PreparingOverlay />}

      {crop.cropSrc && (
        <PhotoCropper
          imageSrc={crop.cropSrc}
          aspect={GALLERY_CROP.aspect}
          maxLong={GALLERY_CROP.maxLong}
          quality={GALLERY_CROP.quality}
          title="Position the image (square)"
          onConfirm={handleCropConfirm}
          onCancel={crop.advance}
        />
      )}
    </div>
  )
}
