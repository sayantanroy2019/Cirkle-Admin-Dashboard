import { Link } from 'react-router-dom'
import { listInvitations } from '../api/oversight'
import { listEvents } from '../api/events'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import { formatDateTime, fullName, titleCaseOrDash } from '../lib/format'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import FilterBar from '../components/FilterBar'
import Select from '../components/Select'
import Badge from '../components/Badge'
import { INVITATION_STATUS_TONE } from '../lib/status'
import { Phone } from '../components/Contact'

const STATUS_OPTIONS = ['pending', 'accepted', 'rejected'].map((s) => ({
  id: s,
  label: titleCaseOrDash(s),
}))

const INITIAL = { eventId: '', status: '' }

export default function InvitationsPage() {
  const events = useAsync(listEvents, [])

  const list = usePaginatedList(listInvitations, {
    initialFilters: INITIAL,
    errorLabel: "Couldn't load invitations.",
  })

  const columns = [
    {
      key: 'user',
      header: 'Requested by',
      className: 'text-gray-900',
      render: (i) => (
        <span>
          <Link
            to={`/users/${i.user?.id}`}
            className="font-medium text-brand hover:text-brand-dark"
          >
            {fullName(i.user?.firstName)}
          </Link>
          <span className="block text-xs text-gray-500">
            <Phone value={i.user?.phone} />
            {i.user?.age != null && ` · ${i.user.age}`}
            {i.user?.gender && ` · ${titleCaseOrDash(i.user.gender)}`}
          </span>
        </span>
      ),
    },
    { key: 'event', header: 'Event', render: (i) => i.event?.name ?? '—' },
    {
      key: 'organizer',
      header: 'Organizer',
      render: (i) =>
        i.organizer?.name ? (
          <Link
            to={`/organizers/${i.organizer.id}`}
            className="text-brand hover:text-brand-dark"
          >
            {i.organizer.name}
          </Link>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => (
        <Badge tone={INVITATION_STATUS_TONE[i.status] ?? 'gray'} dot>
          {titleCaseOrDash(i.status)}
        </Badge>
      ),
    },
    { key: 'requested', header: 'Requested', render: (i) => formatDateTime(i.createdAt) },
    {
      key: 'decided',
      header: 'Decided',
      render: (i) =>
        i.status === 'pending' ? (
          <span className="text-gray-400">—</span>
        ) : (
          formatDateTime(i.updatedAt)
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Invitations"
        description="Every invitation request across the platform. Organizers approve or reject these in their own dashboard — this view is read-only."
      />

      <FilterBar columns={2} showClear={list.hasFilters} onClear={list.clearFilters}>
        <Select
          label="Event"
          value={list.filters.eventId}
          onChange={(e) => list.setFilter('eventId', e.target.value)}
          options={(events.data ?? []).map((e) => ({ id: e.id, label: e.name }))}
          placeholder="All events"
          disabled={events.loading}
        />
        <Select
          label="Status"
          value={list.filters.status}
          onChange={(e) => list.setFilter('status', e.target.value)}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        loadingLabel="Loading invitations…"
        emptyTitle={
          list.hasFilters ? 'No invitations match these filters.' : 'No invitations yet.'
        }
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
