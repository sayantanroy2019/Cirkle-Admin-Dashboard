import { getRevenue, listRevenueByEvent } from '../api/oversight'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatPaise } from '../lib/format'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Button from '../components/Button'
import Alert from '../components/Alert'

/** The headline numbers get more visual weight than anything else in the portal. */
function StatCard({ label, value, hint, emphasis = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis ? 'border-brand/30 bg-brand-light/40' : 'border-gray-200'
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      <p
        className={`mt-1.5 tabular-nums ${
          emphasis ? 'text-2xl font-semibold text-brand' : 'text-xl font-semibold text-gray-900'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-4">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="mt-2.5 h-6 w-24 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

export default function RevenuePage() {
  const summary = useAsync(getRevenue)
  const byEvent = usePaginatedList(listRevenueByEvent, {
    errorLabel: "Couldn't load per-event revenue.",
  })

  const columns = [
    {
      key: 'event',
      header: 'Event',
      className: 'font-medium text-gray-900',
      render: (r) => (
        <span>
          {r.eventName}
          {r.eventStartsAt && (
            <span className="block text-xs font-normal text-gray-500">
              {formatDateTime(r.eventStartsAt)}
            </span>
          )}
        </span>
      ),
    },
    { key: 'gross', header: 'Gross', className: 'tabular-nums', render: (r) => formatPaise(r.grossPaise) },
    {
      key: 'discounts',
      header: 'Discounts',
      className: 'tabular-nums',
      render: (r) => (r.discountsPaise ? `− ${formatPaise(r.discountsPaise)}` : formatPaise(0)),
    },
    { key: 'net', header: 'Net (pre-GST)', className: 'tabular-nums', render: (r) => formatPaise(r.netBeforeGstPaise) },
    { key: 'gst', header: 'GST', className: 'tabular-nums', render: (r) => formatPaise(r.gstCollectedPaise) },
    {
      key: 'collected',
      header: 'Collected',
      className: 'font-semibold text-gray-900 tabular-nums',
      render: (r) => formatPaise(r.totalCollectedPaise),
    },
    {
      key: 'refunded',
      header: 'Refunded',
      className: 'tabular-nums',
      render: (r) =>
        r.refundedPaise ? (
          <span className="text-gray-900">{formatPaise(r.refundedPaise)}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    { key: 'orders', header: 'Paid orders', className: 'tabular-nums', render: (r) => r.paidOrderCount },
    { key: 'tickets', header: 'Tickets', className: 'tabular-nums', render: (r) => r.ticketsSold },
  ]

  const s = summary.data

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Counted from paid orders only. Refunds are shown separately, never netted into the totals."
      />

      {summary.loading ? (
        <SummarySkeleton />
      ) : summary.error ? (
        <div className="rounded-xl border border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-600">
            {errorMessage(summary.error, "Couldn't load the revenue summary.")}
          </p>
          <Button variant="secondary" className="mt-4" onClick={summary.reload}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gross" value={formatPaise(s.grossPaise)} hint="Before discounts" />
            <StatCard
              label="Discounts"
              value={s.discountsPaise ? `− ${formatPaise(s.discountsPaise)}` : formatPaise(0)}
              hint="Coupons applied"
            />
            <StatCard label="Net before GST" value={formatPaise(s.netBeforeGstPaise)} hint="Gross − discounts" />
            <StatCard label="GST collected" value={formatPaise(s.gstCollectedPaise)} />
            <StatCard
              label="Total collected"
              value={formatPaise(s.totalCollectedPaise)}
              hint="What actually hit Razorpay"
              emphasis
            />
            <StatCard
              label="Refunded"
              value={formatPaise(s.refundedPaise)}
              hint="Not deducted above"
            />
            <StatCard label="Paid orders" value={s.paidOrderCount} />
            <StatCard label="Tickets sold" value={s.ticketsSold} />
          </div>

          {s.refundedPaise > 0 && (
            <Alert tone="warning" className="mt-4">
              Collected <strong>{formatPaise(s.totalCollectedPaise)}</strong> · Refunded{' '}
              <strong>{formatPaise(s.refundedPaise)}</strong>. Refunds are reported alongside
              rather than subtracted, so neither figure hides the other.
            </Alert>
          )}
        </>
      )}

      <h2 className="mt-8 mb-1 text-base font-semibold tracking-tight text-gray-900">
        By event
      </h2>
      <p className="mb-4 text-sm text-gray-500">The same breakdown per event.</p>

      <DataTable
        columns={columns}
        rows={byEvent.rows}
        loading={byEvent.loading}
        error={byEvent.error}
        onRetry={byEvent.reload}
        loadingLabel="Loading per-event revenue…"
        emptyTitle="No events yet."
        pagination={{
          page: byEvent.page,
          pageCount: byEvent.pageCount,
          total: byEvent.total,
          limit: byEvent.limit,
          rowCount: byEvent.rows.length,
          onPageChange: byEvent.setPage,
        }}
      />
    </>
  )
}
