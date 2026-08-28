import { useRef, useState } from 'react'
import { setItinerary, uploadItinerary } from '../api/events'
import { errorMessage } from '../lib/errors'
import Button from './Button'
import Alert from './Alert'
import Spinner from './Spinner'

/**
 * Single itinerary-PDF slot on the presign handshake.
 *
 * pick PDF → upload to S3 (progress visible) → "Save itinerary" attaches the
 * key. No crop pipeline — the file is sent exactly as picked. Save is blocked
 * while the upload is in flight or errored, and a failed upload retries with
 * the same file rather than making the admin re-pick it.
 *
 * Unlike the banner there IS a remove action: clearing hides the Itinerary
 * section in the consumer app entirely, which is a meaningful state — "this
 * event has no itinerary" — not just a missing image.
 */
export default function ItineraryUploader({ eventId, itineraryUrl, onChange }) {
  const inputRef = useRef(null)

  // The staged upload: { file, key, status: 'uploading'|'done'|'error', progress, error }
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  const runUpload = async (file) => {
    setPending({ file, key: null, status: 'uploading', progress: 0, error: '' })
    try {
      const { key } = await uploadItinerary(eventId, file, (progress) =>
        setPending((p) => (p ? { ...p, progress } : p)),
      )
      setPending((p) => (p ? { ...p, key, status: 'done' } : p))
    } catch (err) {
      setPending((p) => (p ? { ...p, status: 'error', error: errorMessage(err, 'Upload failed.') } : p))
    }
  }

  const handlePick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // same file can be re-picked after a cancel
    if (!file) return
    setError('')
    if (file.type !== 'application/pdf') {
      setError('The itinerary must be a PDF file.')
      return
    }
    runUpload(file)
  }

  const handleSave = async () => {
    if (!pending?.key) return
    setSaving(true)
    setError('')
    try {
      const freshUrl = await setItinerary(eventId, pending.key)
      setPending(null)
      onChange(freshUrl)
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the itinerary."))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError('')
    try {
      await setItinerary(eventId, null)
      onChange(null)
    } catch (err) {
      setError(errorMessage(err, "Couldn't remove the itinerary."))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert>}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePick}
        className="hidden"
      />

      {pending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
            {pending.status === 'uploading' && <Spinner className="size-4 shrink-0 text-gray-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{pending.file.name}</p>
              <p className="text-xs text-gray-500">
                {pending.status === 'uploading' && `Uploading… ${pending.progress}%`}
                {pending.status === 'done' && 'Uploaded — not saved yet'}
                {pending.status === 'error' && <span className="text-red-600">{pending.error}</span>}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving} disabled={pending.status !== 'done' || saving}>
              {saving ? 'Saving…' : 'Save itinerary'}
            </Button>
            {pending.status === 'error' && (
              <Button variant="secondary" onClick={() => runUpload(pending.file)}>
                Retry upload
              </Button>
            )}
            <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : itineraryUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={itineraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand hover:text-brand-dark"
          >
            View current itinerary (PDF)
          </a>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button variant="caution" onClick={handleRemove} loading={removing}>
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500">No itinerary uploaded.</p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Upload PDF
          </Button>
        </div>
      )}
    </div>
  )
}
