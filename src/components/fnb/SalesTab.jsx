import { useCallback, useState } from 'react'
import { listSales, listStalls, reverseSale } from '../../api/fnb'
import usePaginatedList from '../../hooks/usePaginatedList'
import useAsync from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatPaise } from '../../lib/format'
import DataTable from '../DataTable'
import FilterBar from '../FilterBar'
import Select from '../Select'
import Badge from '../Badge'
import Alert from '../Alert'
import Button from '../Button'

/**
 * Bills at this event (spec §3.5 / §3.7). Reversal lives here and nowhere
 * else: a stall can never undo a sale. Every reversal needs a reason, is
 * audited, re-credits the wallet and tells the attendee on WhatsApp.
 */
export default function SalesTab({ event, onChanged }) {
  const fetcher = useCallback((params) => listSales(event.id, params), [event.id])
  const list = usePaginatedList(fetcher, {
    initialFilters: { stallId: '', status: '' },
    errorLabel: "Couldn't load the bills.",
  })
  const stallsFetcher = useCallback(() => listStalls(event.id), [event.id])
  const stalls = useAsync(stallsFetcher, [])
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState('')

  const reverse = async (sale) => {
    if (busyId) return
    const reason = window.prompt(
      `Reverse bill #${sale.billNo} (${formatPaise(sale.totalPaise)} at ${sale.stall.name})?\n\nThe attendee's wallet is re-credited immediately and they are told on WhatsApp. Enter the reason:`,
    )
    if (reason === null) return
    if (!reason.trim()) {
      setNotice({ tone: 'error', text: 'A reason is required.' })
      return
    }
    setBusyId(sale.id)
    setNotice(null)
    try {
      const r = await reverseSale(sale.id, reason.trim())
      setNotice({ tone: 'success', text: `Bill #${sale.billNo} reversed — ${formatPaise(sale.totalPaise)} back in the wallet (now ${formatPaise(r.wallet.balancePaise)}).` })
      await list.reload()
      await onChanged?.()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err, "Couldn't reverse that bill.") })
    } finally {
      setBusyId('')
    }
  }

  const columns = [
    { key: 'bill', header: 'Bill', className: 'tabular-nums font-medium text-gray-900', render: (s) => `#${s.billNo}` },
    { key: 'when', header: 'When', render: (s) => formatDateTime(s.createdAt) },
    { key: 'stall', header: 'Stall', render: (s) => s.stall.name },
    { key: 'who', header: 'Attendee', render: (s) => (s.firstName ? `${s.firstName} · ` : '') + s.phoneMasked },
    {
      key: 'items', header: 'Items',
      render: (s) => <span className="text-gray-600">{s.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</span>,
    },
    { key: 'total', header: 'Total', className: 'tabular-nums', render: (s) => formatPaise(s.totalPaise) },
    {
      key: 'status', header: 'Status',
      render: (s) => (
        <Badge tone={s.status === 'paid' ? 'green' : 'gray'} dot>
          {s.status === 'paid' ? 'Paid' : 'Reversed'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: (s) =>
        s.status === 'paid' ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); reverse(s) }}
            disabled={!!busyId}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-60"
          >
            {busyId === s.id ? 'Reversing…' : 'Reverse'}
          </button>
        ) : (
          <span className="text-xs text-gray-400" title={s.reversalReason ?? ''}>{s.reversalReason ? `“${s.reversalReason}”` : ''}</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Every bill charged at a stall. Reversing a bill is the only way a sale is undone — a stall cannot do it. The wallet is re-credited at once, the attendee is told on WhatsApp, and the reason is kept.
      </p>
      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <FilterBar columns={3} showClear={list.hasFilters} onClear={list.clearFilters}>
        <Select
          label="Stall"
          value={list.filters.stallId}
          onChange={(e) => list.setFilter('stallId', e.target.value)}
          options={(stalls.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
          placeholder="All stalls"
          disabled={stalls.loading}
        />
        <Select
          label="Status"
          value={list.filters.status}
          onChange={(e) => list.setFilter('status', e.target.value)}
          options={[{ id: 'paid', label: 'Paid' }, { id: 'reversed', label: 'Reversed' }]}
          placeholder="All"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        loadingLabel="Loading bills…"
        emptyTitle={list.hasFilters ? 'No bills match.' : 'No bills yet.'}
        emptyHint={list.hasFilters ? 'Try clearing the filters.' : 'Bills appear here as stalls charge wallets.'}
        pagination={{ page: list.page, pageCount: list.pageCount, total: list.total, limit: list.limit, rowCount: list.rows.length, onPageChange: list.setPage }}
      />
      {list.total > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={list.reload} disabled={list.loading}>Refresh</Button>
        </div>
      )}
    </div>
  )
}
