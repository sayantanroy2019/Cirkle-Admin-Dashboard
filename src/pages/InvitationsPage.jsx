import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listInvitations } from '../api/oversight'
import { listEvents } from '../api/events'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import { formatDateTime, fullName, titleCaseOrDash } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { exportToXlsx, fetchAllRows, slugForFilename, todayForFilename } from '../lib/exportXlsx'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import FilterBar from '../components/FilterBar'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { INVITATION_STATUS_TONE } from '../lib/status'
import { Phone } from '../components/Contact'

// What lands in the sheet — the table's columns, unpacked into plain cells,
// plus the ids so a row can be traced back. Phone is whatever the API gave
// this admin (masked for BD), same as the table.
const EXPORT_COLUMNS = [
  { header: 'Requested by', value: (i) => fullName(i.user?.firstName) },
  { header: 'Phone', value: (i) => i.user?.phone ?? '' },
  { header: 'Age', value: (i) => i.user?.age ?? '' },
  { header: 'Gender', value: (i) => (i.user?.gender ? titleCaseOrDash(i.user.gender) : '') },
  { header: 'Event', value: (i) => i.event?.name ?? '' },
  { header: 'Organizer', value: (i) => i.organizer?.name ?? 'Unassigned' },
  { header: 'Status', value: (i) => titleCaseOrDash(i.status) },
  { header: 'Requested at', value: (i) => formatDateTime(i.createdAt) },
  { header: 'Decided at', value: (i) => (i.status === 'pending' ? '' : formatDateTime(i.updatedAt)) },
  { header: 'Invitation ID', value: (i) => i.id },
  { header: 'User ID', value: (i) => i.user?.id ?? '' },
  { header: 'Event ID', value: (i) => i.event?.id ?? '' },
]

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

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Exports what the filters select — every page of it, not just this one.
  // The same filters go to the same endpoint, so the sheet and the table can
  // never disagree.
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      const rows = await fetchAllRows(listInvitations, list.filters)
      const eventName = list.filters.eventId
        ? (events.data ?? []).find((e) => e.id === list.filters.eventId)?.name
        : null
      const filename = [
        'invitations',
        slugForFilename(eventName, 'all-events'),
        list.filters.status || 'all-statuses',
        todayForFilename(),
      ].join('_') + '.xlsx'
      await exportToXlsx({ rows, columns: EXPORT_COLUMNS, sheetName: 'Invitations', filename })
    } catch (err) {
      setExportError(errorMessage(err, "Couldn't export the invitations."))
    } finally {
      setExporting(false)
    }
  }

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
      >
        <Button
          variant="secondary"
          onClick={handleExport}
          loading={exporting}
          disabled={list.loading || list.total === 0}
          title="Downloads an Excel sheet of every row the current filters select"
        >
          {exporting
            ? 'Exporting…'
            : `Export${list.total ? ` ${list.total.toLocaleString('en-IN')}` : ''} to Excel`}
        </Button>
      </PageHeader>

      {exportError && (
        <Alert tone="error" className="mb-4" onDismiss={() => setExportError('')}>
          {exportError}
        </Alert>
      )}

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
