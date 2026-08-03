import { useNavigate } from 'react-router-dom'
import { listTickets } from '../api/oversight'
import { listEvents } from '../api/events'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import { formatDateTime, fullName } from '../lib/format'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import FilterBar from '../components/FilterBar'
import Select from '../components/Select'
import Badge from '../components/Badge'
import { Phone } from '../components/Contact'

const CHECKED_IN_OPTIONS = [
  { id: 'false', label: 'Not checked in' },
  { id: 'true', label: 'Checked in' },
]

const INITIAL = { eventId: '', checkedIn: '' }

export default function TicketsPage() {
  const navigate = useNavigate()
  const events = useAsync(listEvents, [])

  const list = usePaginatedList(listTickets, {
    initialFilters: INITIAL,
    errorLabel: "Couldn't load tickets.",
  })

  const selectedEvent = (events.data ?? []).find((e) => e.id === list.filters.eventId)

  const columns = [
    {
      key: 'ref',
      header: 'Booking ref',
      className: 'font-mono text-xs font-medium text-gray-900',
      render: (t) => t.bookingRef,
    },
    {
      key: 'event',
      header: 'Event',
      render: (t) => (
        <span>
          <span className="text-gray-900">{t.event?.name ?? '—'}</span>
          {t.event?.startsAt && (
            <span className="block text-xs text-gray-500">{formatDateTime(t.event.startsAt)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'holder',
      header: 'Holder',
      render: (t) => (
        <span>
          {fullName(t.user?.firstName)} · <Phone value={t.user?.phone} />
        </span>
      ),
    },
    {
      key: 'checkedIn',
      header: 'Check-in',
      render: (t) =>
        t.checkedIn ? (
          <span>
            <Badge tone="green" dot>
              Checked in
            </Badge>
            {t.checkedInAt && (
              <span className="block text-xs text-gray-500">{formatDateTime(t.checkedInAt)}</span>
            )}
          </span>
        ) : (
          <Badge tone="gray" dot>
            Not checked in
          </Badge>
        ),
    },
    { key: 'created', header: 'Issued', render: (t) => formatDateTime(t.createdAt) },
  ]

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Every ticket issued. Filter by event to get that event's guest list."
      />

      <FilterBar columns={2} showClear={list.hasFilters} onClear={list.clearFilters}>
        <Select
          label="Event (guest list)"
          value={list.filters.eventId}
          onChange={(e) => list.setFilter('eventId', e.target.value)}
          options={(events.data ?? []).map((e) => ({ id: e.id, label: e.name }))}
          placeholder="All events"
          disabled={events.loading}
          hint="Pick an event to turn this table into its attendee list."
        />
        <Select
          label="Check-in status"
          value={list.filters.checkedIn}
          onChange={(e) => list.setFilter('checkedIn', e.target.value)}
          options={CHECKED_IN_OPTIONS}
          placeholder="Any"
        />
      </FilterBar>

      {selectedEvent && !list.loading && (
        <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-2.5 text-sm text-gray-600">
          Guest list for <span className="font-medium text-gray-900">{selectedEvent.name}</span> —{' '}
          <span className="font-medium text-gray-900">{list.total}</span>{' '}
          {list.total === 1 ? 'ticket' : 'tickets'}
          {list.filters.checkedIn === 'false' && ' still to check in'}
          {list.filters.checkedIn === 'true' && ' checked in'}.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(t) => navigate(`/tickets/${t.id}`)}
        loadingLabel="Loading tickets…"
        emptyTitle={list.hasFilters ? 'No tickets match these filters.' : 'No tickets yet.'}
        emptyHint={list.hasFilters ? 'Try clearing them.' : undefined}
        pagination={{
          page: list.page,
          pageCount: list.pageCount,
          total: list.total,
          limit: list.limit,
          rowCount: list.rows.length,
          onPageChange: list.setPage,
        }}
      />
    </>
  )
}
