import { useNavigate } from 'react-router-dom'
import { listFnbEvents } from '../../api/fnb'
import usePaginatedList from '../../hooks/usePaginatedList'
import { formatDateTime, titleCaseOrDash } from '../../lib/format'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import FilterBar from '../../components/FilterBar'
import Select from '../../components/Select'
import Button from '../../components/Button'
import Badge from '../../components/Badge'

export const FNB_STATUS_TONE = { draft: 'gray', live: 'green', ended: 'amber' }
const STATUS_OPTIONS = ['draft', 'live', 'ended'].map((s) => ({ id: s, label: titleCaseOrDash(s) }))

export default function FnbEventsPage() {
  const navigate = useNavigate()
  const list = usePaginatedList(listFnbEvents, {
    initialFilters: { status: '' },
    errorLabel: "Couldn't load F&B events.",
  })

  const columns = [
    {
      key: 'name', header: 'Event', className: 'font-medium text-gray-900',
      render: (e) => (
        <span>
          {e.name}
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">{e.code}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (e) => <Badge tone={FNB_STATUS_TONE[e.status] ?? 'gray'} dot>{titleCaseOrDash(e.status)}</Badge> },
    { key: 'organizer', header: 'Organizer', render: (e) => e.organizer?.displayName ?? <span className="text-gray-400">—</span> },
    { key: 'stalls', header: 'Stalls', className: 'tabular-nums', render: (e) => e.counts.stalls },
    { key: 'topup', header: 'Top‑up users', className: 'tabular-nums', render: (e) => e.counts.topupUsers },
    { key: 'menu', header: 'Menu items', className: 'tabular-nums', render: (e) => e.counts.menuItems },
    { key: 'created', header: 'Created', render: (e) => formatDateTime(e.createdAt) },
  ]

  return (
    <>
      <PageHeader
        title="F&B events"
        description="Food & beverage payment collection. Create an event, then set up its top‑up users, stall counters and menus inside it."
      >
        <Button to="/fnb/new">Create F&B event</Button>
      </PageHeader>

      <FilterBar columns={2} showClear={list.hasFilters} onClear={list.clearFilters}>
        <Select label="Status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} options={STATUS_OPTIONS} placeholder="All statuses" />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(e) => navigate(`/fnb/${e.id}`)}
        loadingLabel="Loading F&B events…"
        emptyTitle={list.hasFilters ? 'No F&B events match.' : 'No F&B events yet.'}
        emptyHint={list.hasFilters ? 'Try clearing the filter.' : 'Create the first one to start setting up counters and menus.'}
        pagination={{ page: list.page, pageCount: list.pageCount, total: list.total, limit: list.limit, rowCount: list.rows.length, onPageChange: list.setPage }}
      />
    </>
  )
}
