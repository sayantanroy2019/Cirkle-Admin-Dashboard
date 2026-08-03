import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createEvent } from '../api/events'
import useEventOptions from '../hooks/useEventOptions'
import { errorMessage } from '../lib/errors'
import {
  emptyEventForm,
  formToCreatePayload,
  validateEventForm,
} from '../lib/eventForm'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Alert from '../components/Alert'
import EventFields from '../components/EventFields'
import Spinner from '../components/Spinner'

export default function EventCreatePage() {
  const navigate = useNavigate()
  const options = useEventOptions()

  const [form, setForm] = useState(emptyEventForm)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const setField = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((errs) => ({ ...errs, [key]: '' }))
  }

  /** Checkboxes carry their state on `checked`, not `value`. */
  const setChecked = (key) => (e) => {
    const { checked } = e.target
    setForm((f) => ({ ...f, [key]: checked }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    // Create always sends startsAt, so the future-date rule always applies.
    const errs = validateEventForm(form, { requireAll: true, enforceFutureStart: true })
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const created = await createEvent(formToCreatePayload(form))

      // Images can't be uploaded until the event has an id, so creation lands
      // on the edit screen where the banner and gallery live.
      navigate(`/events/${created.id}`, {
        replace: true,
        state: { flash: 'Event created. Add a banner and gallery images below.' },
      })
    } catch (err) {
      setFormError(errorMessage(err, "Couldn't create the event."))
      setSubmitting(false)
    }
  }

  if (options.loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading form…
      </p>
    )
  }

  return (
    <>
      <PageHeader
        title="Create event"
        description="Images are added on the next screen, once the event has an id."
      />

      <div className="max-w-2xl">
        <Link to="/events" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to events
        </Link>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          {options.error && (
            <Alert tone="warning">
              Couldn't load organizers, categories or cities.{' '}
              <button type="button" onClick={options.reload} className="underline">
                Retry
              </button>
            </Alert>
          )}

          <EventFields
            form={form}
            setField={setField}
            setChecked={setChecked}
            errors={errors}
            options={options}
            disabled={submitting}
          />

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting}>
              {submitting ? 'Creating…' : 'Create event'}
            </Button>
            <Button variant="secondary" to="/events">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
