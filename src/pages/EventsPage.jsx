import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listEvents } from '../api/events'
import useEventOptions from '../hooks/useEventOptions'
import { errorMessage } from '../lib/errors'
import { EVENT_TYPE_LABELS, formatDate, formatTime, isPast } from '../lib/format'
import { describeCapacityCell, describePriceRange } from '../lib/capacity'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Alert from '../components/Alert'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'

// Price and Capacity come from the per-event `priceRange` / `capacitySummary`
// the list endpoint now derives from the ticket categories — the same
// derivation the detail view uses, so the two can't disagree.
const COLUMNS = [
  'Event', 'Organizer', 'Category', 'City', 'Starts', 'Price', 'Capacity', 'Type', 'Status',
]

/** Shown wherever an event has no ticket categories configured yet. */
const NoCategories = () => <span className="text-gray-400">No categories</span>

const STATUS_OPTIONS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <tr key={i} className="border-t border-gray-100">
      {COLUMNS.map((c) => (
        <td key={c} className="px-4 py-3.5">
          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  ))
}

export default function EventsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const options = useEventOptions()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(location.state?.flash ?? '')

  // All three are server-side filters on GET /admin/events.
  const [filters, setFilters] = useState({ organizerId: '', cityId: '', status: '' })

  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const load = useCallback(async (active) => {
    setLoading(true)
    setError('')
    try {
      setEvents(await listEvents(active))
    } catch (err) {
      setError(errorMessage(err, "Couldn't load events."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
  }, [load, filters])

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader title="Events" description="Create events and assign them to organizers.">
        <Button to="/events/new">Create event</Button>
      </PageHeader>

      {flash && (
        <Alert className="mb-4" tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select
          label="Organizer"
          value={filters.organizerId}
          onChange={setFilter('organizerId')}
          options={options.organizerOptions(filters.organizerId)}
          placeholder="All organizers"
          disabled={options.loading}
        />
        <Select
          label="City"
          value={filters.cityId}
          onChange={setFilter('cityId')}
          options={options.cities}
          placeholder="All cities"
          disabled={options.loading}
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={setFilter('status')}
          options={STATUS_OPTIONS}
          placeholder="All events"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
          <p className="text-sm text-gray-600">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => load(filters)}>
            Try again
          </Button>
        </div>
      ) : !loading && events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-900">
            {hasFilters ? 'No events match these filters.' : 'No events yet.'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {hasFilters ? 'Try clearing them.' : 'Create one to get started.'}
          </p>
          {hasFilters ? (
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => setFilters({ organizerId: '', cityId: '', status: '' })}
            >
              Clear filters
            </Button>
          ) : (
            <Button to="/events/new" className="mt-5">
              Create event
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {COLUMNS.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  events.map((e) => {
                    const past = isPast(e.startsAt)
                    return (
                      <tr
                        key={e.id}
                        onClick={() => navigate(`/events/${e.id}`)}
                        className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              navigate(`/events/${e.id}`)
                            }}
                            className="rounded-sm text-left font-medium text-gray-900 hover:text-brand"
                          >
                            {e.name}
                          </button>
                        </td>
                        <td className="max-w-[11rem] truncate px-4 py-3.5 text-gray-600">
                          {e.organizerName ? (
                            <span title={e.organizerName}>{e.organizerName}</span>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                          {options.categories.find((c) => c.id === e.categoryId)?.label ??
                            e.categoryId}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                          {options.cities.find((c) => c.id === e.cityId)?.label ?? e.cityId}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                          {formatDate(e.startsAt)}
                          <span className="block text-xs text-gray-500">
                            {formatTime(e.startsAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 tabular-nums">
                          {describePriceRange(e.priceRange) ?? <NoCategories />}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                          {(() => {
                            const cap = describeCapacityCell(e.capacitySummary, e.priceRange)
                            if (!cap) return <NoCategories />
                            return (
                              <span className="tabular-nums">
                                {cap.people}
                                {cap.tickets && (
                                  <span className="block text-xs text-gray-500">{cap.tickets}</span>
                                )}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge tone={e.eventType === 'invite_only' ? 'purple' : 'gray'}>
                            {EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge tone={past ? 'gray' : 'green'}>{past ? 'Past' : 'Upcoming'}</Badge>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Spinner className="size-3" />
          Loading events…
        </p>
      )}
    </>
  )
}
