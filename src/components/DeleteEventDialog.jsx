import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteEvent, getDeletionPreview } from '../api/events'
import { conflictCode, errorMessage } from '../lib/errors'
import { REASON_MAX, describeDependents, describeOutcome } from '../lib/eventDeletion'
import Button from './Button'
import Alert from './Alert'
import Field from './Field'
import Textarea from './Textarea'
import Spinner from './Spinner'

/**
 * The confirmation behind "Delete this event…".
 *
 * Opens by asking the backend what deleting would do, says it in plain words
 * — cancelled or permanently deleted, and what goes with it — then needs the
 * event's name typed exactly before the one red button enables. The backend
 * checks the typed name again and decides the outcome under a lock, so this
 * dialog is the explanation, not the enforcement.
 */
export default function DeleteEventDialog({ event, onClose, onDeleted, onCancelled, onAlreadyCancelled }) {
  const titleId = useId()
  const nameInput = useRef(null)

  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // From a 409 fnb_event_linked on submit — someone linked an F&B event
  // after the preview was taken. Overrides what the preview said.
  const [linkedFnb, setLinkedFnb] = useState(null)

  // Callbacks are read through a ref so the preview fetch runs once per
  // event, not once per parent render (the parent passes inline arrows).
  const callbacks = useRef({ onAlreadyCancelled })
  callbacks.current = { onAlreadyCancelled }

  useEffect(() => {
    let active = true
    getDeletionPreview(event.id)
      .then((p) => {
        if (active) setPreview(p)
      })
      .catch((err) => {
        if (!active) return
        if (conflictCode(err) === 'already_cancelled') {
          callbacks.current.onAlreadyCancelled()
          return
        }
        setPreviewError(errorMessage(err, "Couldn't check what deleting this event would do."))
      })
    return () => {
      active = false
    }
  }, [event.id])

  useEffect(() => {
    if (preview) nameInput.current?.focus()
  }, [preview])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  const matches = typed.trim() === event.name
  const fnbBlockers = linkedFnb ?? preview?.fnbEvents ?? []
  // Only the delete path can be blocked — cancel leaves the F&B link alone.
  const blocked = preview?.outcome === 'delete' && fnbBlockers.length > 0
  const words = preview ? describeOutcome(preview) : null
  const dependents = describeDependents(preview?.counts)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!matches || blocked || submitting) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await deleteEvent(event.id, { confirmName: typed.trim(), reason: reason.trim() })
      if (result.outcome === 'deleted') onDeleted()
      else onCancelled(result.event)
    } catch (err) {
      const code = conflictCode(err)
      if (code === 'already_cancelled') {
        onAlreadyCancelled()
        return
      }
      if (code === 'fnb_event_linked') setLinkedFnb(err.response?.data?.fnbEvents ?? [])
      setSubmitError(errorMessage(err, "Couldn't delete this event."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        {!preview && !previewError && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Spinner />
            Checking what deleting this event would do…
          </p>
        )}

        {previewError && (
          <>
            <Alert tone="error">{previewError}</Alert>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}

        {preview && words && (
          <form onSubmit={handleSubmit} noValidate>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              {words.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{words.body}</p>
            {dependents.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {preview.outcome === 'delete' ? 'Goes with it: ' : 'Also attached: '}
                {dependents.join(', ')}.
              </p>
            )}

            {blocked && (
              <Alert tone="warning" className="mt-4">
                Can't delete yet — {fnbBlockers.length === 1 ? 'an F&B event is' : 'F&B events are'} linked to
                this one:{' '}
                {fnbBlockers.map((f, i) => (
                  <span key={f.id}>
                    {i > 0 && ', '}
                    <Link to={`/fnb/${f.id}`} className="font-medium underline">
                      {f.name}
                    </Link>
                  </span>
                ))}
                . Unlink {fnbBlockers.length === 1 ? 'it' : 'them'} there first.
              </Alert>
            )}

            {submitError && (
              <Alert tone="error" className="mt-4">
                {submitError}
              </Alert>
            )}

            <div className="mt-5 space-y-4">
              <Textarea
                label={
                  preview.outcome === 'cancel'
                    ? 'Reason — the organizer sees it, and it goes in the audit log'
                    : 'Reason (optional, kept in the audit log)'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={REASON_MAX}
                rows={2}
                disabled={submitting || blocked}
                hint={`${reason.length}/${REASON_MAX}`}
              />
              <Field
                ref={nameInput}
                label={
                  <>
                    Type <span className="font-semibold text-gray-900">{event.name}</span> to confirm
                  </>
                }
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={event.name}
                autoComplete="off"
                spellCheck={false}
                disabled={submitting || blocked}
                hint="Must match exactly, capitals included."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Keep event
              </Button>
              <Button type="submit" variant="danger" loading={submitting} disabled={!matches || blocked}>
                {submitting ? 'Working…' : words.confirmLabel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
