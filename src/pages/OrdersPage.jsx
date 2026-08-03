import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayRangeToInstants, listOrders } from '../api/oversight'
import { listEvents } from '../api/events'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import { formatDateTime, formatPaise, fullName, shortId, titleCaseOrDash } from '../lib/format'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import FilterBar from '../components/FilterBar'
import Select from '../components/Select'
import Field from '../components/Field'
import Badge from '../components/Badge'
import { ORDER_STATUS_TONE } from '../lib/status'
import { Phone } from '../components/Contact'

const STATUS_OPTIONS = ['created', 'paid', 'failed', 'expired', 'refunded'].map((s) => ({
  id: s,
  label: titleCaseOrDash(s),
}))

const INITIAL = { status: '', eventId: '', from: '', to: '' }

export default function OrdersPage() {
  const navigate = useNavigate()
  const events = useAsync(listEvents, [])

  // `from`/`to` are calendar days in the UI; the API compares against
  // created_at directly, so they're widened to cover the whole local day.
  const mapFilters = useCallback(
    ({ status, eventId, from, to }) => ({
      status,
      eventId,
      ...dayRangeToInstants({ from, to }),
    }),
    [],
  )

  const list = usePaginatedList(listOrders, {
    initialFilters: INITIAL,
    mapFilters,
    errorLabel: "Couldn't load orders.",
  })

  const columns = [
    {
      key: 'id',
      header: 'Order',
      className: 'font-medium text-gray-900',
      render: (o) => (
        <span title={o.id} className="tabular-nums">
          {shortId(o.id)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'gray'} dot>
          {titleCaseOrDash(o.status)}
        </Badge>
      ),
    },
    { key: 'event', header: 'Event', render: (o) => o.event?.name ?? '—' },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (o) => (
        <span>
          {fullName(o.user?.firstName)} · <Phone value={o.user?.phone} />
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'tabular-nums',
      render: (o) => formatPaise(o.breakdown?.totalPaise),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (o) =>
        o.paymentMethod ? (
          <span>
            {titleCaseOrDash(o.paymentMethod)}
            {o.paymentMethodDetail ? ` · ${o.paymentMethodDetail}` : ''}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    { key: 'created', header: 'Created', render: (o) => formatDateTime(o.createdAt) },
  ]

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order placed on the platform, with its frozen price breakdown."
      />

      <FilterBar
        columns={4}
        showClear={list.hasFilters}
        onClear={list.clearFilters}
      >
        <Select
          label="Status"
          value={list.filters.status}
          onChange={(e) => list.setFilter('status', e.target.value)}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
        />
        <Select
          label="Event"
          value={list.filters.eventId}
          onChange={(e) => list.setFilter('eventId', e.target.value)}
          options={(events.data ?? []).map((e) => ({ id: e.id, label: e.name }))}
          placeholder="All events"
          disabled={events.loading}
        />
        <Field
          label="From"
          type="date"
          value={list.filters.from}
          onChange={(e) => list.setFilter('from', e.target.value)}
        />
        <Field
          label="To"
          type="date"
          value={list.filters.to}
          onChange={(e) => list.setFilter('to', e.target.value)}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        loadingLabel="Loading orders…"
        emptyTitle={list.hasFilters ? 'No orders match these filters.' : 'No orders yet.'}
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
