import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getEvent, updateEvent } from '../api/events'
import { listArtists } from '../api/artists'
import useEventOptions from '../hooks/useEventOptions'
import { errorMessage } from '../lib/errors'
import { EVENT_TYPE_LABELS, formatDateTime, isPast } from '../lib/format'
import { changedEventFields, eventToForm, validateEventForm } from '../lib/eventForm'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Alert from '../components/Alert'
import EventFields from '../components/EventFields'
import BannerUploader from '../components/BannerUploader'
import GalleryManager from '../components/GalleryManager'
import LineupManager from '../components/LineupManager'
import Spinner from '../components/Spinner'

function Card({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const options = useEventOptions()

  const [event, setEvent] = useState(null)
  const [form, setForm] = useState(null)
  // The lineup lives on its own endpoint, not on the event payload.
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [flash, setFlash] = useState(location.state?.flash ?? '')

  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [data, lineup] = await Promise.all([getEvent(id), listArtists(id)])
      setEvent(data)
      setForm(eventToForm(data))
      setArtists(lineup)
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load this event."))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  /**
   * PATCH returns the base projection — it has `bannerUrl` but NOT `gallery`
   * or `organizer`. Merging keeps both on screen; replacing would wipe them.
   */
  const applyUpdate = (updated) => setEvent((prev) => ({ ...prev, ...updated }))

  const setField = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((errs) => ({ ...errs, [key]: '' }))
    setFlash('')
  }

  const handleSave = async (submitEvent) => {
    submitEvent.preventDefault()
    if (saving) return

    const payload = changedEventFields(form, event)
    const startsAtChanged = 'startsAt' in payload

    // The backend only enforces the future-date rule when startsAt is in the
    // body, so a past event stays editable as long as the date isn't touched.
    const errs = validateEventForm(form, {
      requireAll: false,
      enforceFutureStart: startsAtChanged,
    })
    setErrors(errs)
    setSaveError('')
    if (Object.keys(errs).length > 0) return

    // An empty PATCH body is a 400 — short-circuit instead of surfacing it.
    if (Object.keys(payload).length === 0) {
      setFlash('No changes to save.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateEvent(id, payload)
      applyUpdate(updated)
      setForm(eventToForm({ ...event, ...updated }))
      setFlash('Event updated.')
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save those changes."))
    } finally {
      setSaving(false)
    }
  }

  if (loading || options.loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading event…
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{loadError}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
          <Button variant="secondary" to="/events">
            Back to events
          </Button>
        </div>
      </div>
    )
  }

  const past = isPast(event.startsAt)

  return (
    <>
      <PageHeader title={event.name}>
        <Button variant="secondary" to="/events">
          Back to events
        </Button>
      </PageHeader>

      <Link to="/events" className="text-sm text-gray-500 hover:text-gray-900">
        ← Events
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            past ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'
          }`}
        >
          {past ? 'Past' : 'Upcoming'}
        </span>
        <span>{formatDateTime(event.startsAt)}</span>
        <span>{EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}</span>
        <span>
          {event.organizer ? (
            <>
              Assigned to{' '}
              <Link
                to={`/organizers/${event.organizer.id}`}
                className="font-medium text-brand hover:text-brand-dark"
              >
                {event.organizer.displayName}
              </Link>
            </>
          ) : (
            <span className="text-gray-400">Unassigned</span>
          )}
        </span>
      </div>

      {flash && (
        <Alert className="mt-4" tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}

      <div className="mt-6 space-y-5">
        <div className="max-w-2xl">
          <Card title="Details">
            <form onSubmit={handleSave} className="space-y-5" noValidate>
              {saveError && <Alert tone="error">{saveError}</Alert>}

              <EventFields
                form={form}
                setField={setField}
                errors={errors}
                options={options}
                disabled={saving}
                showPriceNote
              />

              <Button type="submit" loading={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </Card>
        </div>

        <Card
          title="Banner"
          description="The main image for this event. Replacing it takes effect immediately."
        >
          <BannerUploader
            eventId={id}
            bannerUrl={event.bannerUrl}
            onChange={(bannerUrl) => {
              setEvent((prev) => ({ ...prev, bannerUrl }))
              setFlash('Banner updated.')
            }}
          />
        </Card>

        <Card
          title="Lineup"
          description="Up to 10 artists, in order — the first is the headliner. Names, handles and order save together; photos save as soon as you pick them."
        >
          <LineupManager eventId={id} artists={artists} onChange={setArtists} />
        </Card>

        <Card
          title="Gallery"
          description="Up to 5 additional images, in order. Saving replaces the whole gallery — it's all-or-nothing, so if one image fails nothing changes."
        >
          <GalleryManager
            eventId={id}
            gallery={event.gallery}
            onChange={(gallery) => setEvent((prev) => ({ ...prev, gallery }))}
          />
        </Card>
      </div>
    </>
  )
}
