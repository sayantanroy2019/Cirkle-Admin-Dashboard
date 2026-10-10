import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPaise } from '../../lib/format'
import { exportWorkbook, slugForFilename, todayForFilename } from '../../lib/exportXlsx'

/**
 * The F&B event dashboard (spec Part 4) — ONE component, two homes: the
 * admin portal's Dashboard tab and the organizer dashboard's F&B section.
 * Keep this file identical in both apps; the only differences are the
 * functions passed in.
 *
 *   load        () => Promise<dashboard>      the read model
 *   loadExport  () => Promise<{ event, topups, sales }>
 *   canReverse  whether the Reverse action shows on bills (admin only today)
 *   onReverse   (bill) => Promise<void>       performs the reversal; the
 *                                             dashboard reloads afterwards
 *
 * Refresh (founder, 10 Oct 2026): a Refresh button reloads everything; left
 * alone, the page refreshes itself every 5 minutes and says when it last did.
 */

const AUTO_REFRESH_MS = 5 * 60 * 1000

const whenFull = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'
const whenHour = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', hour12: true })
const whenTime = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
const ago = (ms) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} s ago` : `${Math.round(ms / 60000)} min ago`)
const who = (r) => [r.firstName, r.phoneMasked].filter(Boolean).join(' · ')

function Tile({ label, value, note, tone = 'gray' }) {
  const tones = { gray: 'text-gray-900', green: 'text-green-700', amber: 'text-amber-700', purple: 'text-brand' }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${tones[tone]}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  )
}

function Section({ title, aside, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

const StatusPill = ({ status }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status === 'reversed' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
    {status === 'reversed' ? 'Reversed' : 'Paid'}
  </span>
)

function Timeline({ rows }) {
  if (!rows.length) return <p className="px-5 py-4 text-sm text-gray-500">Nothing yet.</p>
  const max = Math.max(1, ...rows.map((r) => Math.max(r.topupsPaise, r.salesPaise)))
  return (
    <div className="px-5 py-4">
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: 160 }}>
        {rows.map((r) => (
          <div key={r.hour} className="flex min-w-[44px] flex-col items-center justify-end gap-1" title={`${whenHour(r.hour)} · top-ups ${formatPaise(r.topupsPaise)} · sales ${formatPaise(r.salesPaise)}`}>
            <div className="flex h-[120px] items-end gap-0.5">
              <div className="w-4 rounded-t bg-brand/70" style={{ height: `${Math.round((r.topupsPaise / max) * 120)}px` }} />
              <div className="w-4 rounded-t bg-green-500/70" style={{ height: `${Math.round((r.salesPaise / max) * 120)}px` }} />
            </div>
            <span className="whitespace-nowrap text-[10px] text-gray-500">{whenTime(r.hour)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand/70" /> Top-ups</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-green-500/70" /> Sales</span>
      </div>
    </div>
  )
}

export default function FnbDashboard({ load, loadExport, canReverse = false, onReverse }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)
  const [, setTick] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [busyBill, setBusyBill] = useState('')
  const [notice, setNotice] = useState('')
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    setRefreshing(true)
    try {
      const d = await loadRef.current()
      setData(d)
      setError('')
      setLoadedAt(Date.now())
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Couldn't load the dashboard.")
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    reload()
    const auto = setInterval(reload, AUTO_REFRESH_MS)
    const clock = setInterval(() => setTick((t) => t + 1), 15000)
    return () => {
      clearInterval(auto)
      clearInterval(clock)
    }
  }, [reload])

  const doExport = async () => {
    if (exporting) return
    setExporting(true)
    setNotice('')
    try {
      const x = await loadExport()
      const base = `fnb-${slugForFilename(x.event.name)}-${todayForFilename()}`
      await exportWorkbook({
        filename: `${base}.xlsx`,
        sheets: [
          {
            name: 'Top-ups',
            rows: x.topups,
            columns: [
              { header: 'Time', value: (r) => whenFull(r.at) },
              { header: 'Method', value: (r) => r.method },
              { header: 'Amount (₹)', value: (r) => r.amountPaise / 100 },
              { header: 'Status', value: (r) => r.status },
              { header: 'Counter', value: (r) => r.counter },
              { header: 'Attendee', value: (r) => r.firstName ?? '' },
              { header: 'Phone', value: (r) => r.phoneMasked },
              { header: 'Refunded at', value: (r) => whenFull(r.refundedAt) },
              { header: 'Refund reason', value: (r) => r.refundReason ?? '' },
            ],
          },
          {
            name: 'Bills',
            rows: x.sales,
            columns: [
              { header: 'Time', value: (r) => whenFull(r.at) },
              { header: 'Bill #', value: (r) => r.billNo },
              { header: 'Stall', value: (r) => r.stallName },
              { header: 'Items', value: (r) => r.items },
              { header: 'Total (₹)', value: (r) => r.totalPaise / 100 },
              { header: 'Status', value: (r) => r.status },
              { header: 'Attendee', value: (r) => r.firstName ?? '' },
              { header: 'Phone', value: (r) => r.phoneMasked },
              { header: 'Reversed at', value: (r) => whenFull(r.reversedAt) },
              { header: 'Reversal reason', value: (r) => r.reason ?? '' },
            ],
          },
        ],
      })
    } catch (err) {
      setNotice(err?.response?.data?.error || "Couldn't export.")
    } finally {
      setExporting(false)
    }
  }

  const reverse = async (bill) => {
    if (!onReverse || busyBill) return
    setBusyBill(bill.id)
    setNotice('')
    try {
      await onReverse(bill)
      await reload()
    } catch (err) {
      setNotice(err?.response?.data?.message || err?.response?.data?.error || "Couldn't reverse the bill.")
    } finally {
      setBusyBill('')
    }
  }

  if (!data && !error) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />)}
      </div>
    )
  }
  if (!data) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>

  const t = data.totals
  const ev = data.event

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ev.status === 'live' ? 'bg-green-50 text-green-700' : ev.status === 'ended' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'}`}>
            {ev.status === 'live' ? 'Live' : ev.status === 'ended' ? 'Ended' : 'Draft'}
          </span>
          {ev.status === 'ended' && ev.validTill && !ev.expired && <span>balances valid till {whenFull(ev.validTill)} · </span>}
          {ev.expired && <span>balances expired · </span>}
          <span>Updated {loadedAt ? ago(Date.now() - loadedAt) : '—'} · refreshes every 5 min</span>
          {error && <span className="ml-2 text-red-600">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reload} disabled={refreshing} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={doExport} disabled={exporting} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
            {exporting ? 'Preparing…' : 'Export to Excel'}
          </button>
        </div>
      </div>
      {notice && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}

      {/* Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Money in" value={formatPaise(t.topups.totalPaise)} tone="purple"
          note={`${t.topups.count} top-ups · cash ${formatPaise(t.topups.cash.paise)} · UPI ${formatPaise(t.topups.upi.paise)} · online ${formatPaise(t.topups.online.paise)}`} />
        <Tile label="Sales" value={formatPaise(t.sales.paise)} tone="green" note={`${t.sales.bills} bills paid`} />
        <Tile label="Refunds & reversals" value={formatPaise(t.refunds.paise + t.sales.reversedPaise)} tone="amber"
          note={`${t.refunds.count} cash refunds ${formatPaise(t.refunds.paise)} · ${t.sales.reversed} bills reversed ${formatPaise(t.sales.reversedPaise)}`} />
        <Tile label="Still in wallets" value={formatPaise(t.inWalletsPaise)} note={`${t.attendeesWithBalance} of ${t.wallets} attendees hold a balance`} />
        <Tile label="Expired" value={formatPaise(t.expiredPaise)} note={ev.expired ? 'deleted after the event ended' : 'deleted after the event ends'} />
      </div>

      <Section title="Through the day">
        <Timeline rows={data.timeline} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="By stall">
          {data.stalls.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">No stalls yet.</p> : (
            <ul className="divide-y divide-gray-100">
              {data.stalls.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{formatPaise(s.salesPaise)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {s.bills} bills · avg {formatPaise(s.avgBillPaise)}{s.reversed ? ` · ${s.reversed} reversed (${formatPaise(s.reversedPaise)})` : ''}
                  </p>
                  {s.topItems.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.topItems.map((it) => (
                        <span key={it.name} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{it.quantity} × {it.name}</span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Cash reconciliation — top-up counters">
          {data.counters.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">No top-up counters yet.</p> : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2">Volunteer</th>
                  <th className="px-3 py-2 text-right">Cash in</th>
                  <th className="px-3 py-2 text-right">Refunded</th>
                  <th className="px-3 py-2 text-right">To hand over</th>
                  <th className="px-5 py-2 text-right">UPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.counters.map((c) => (
                  <tr key={c.id} className={c.active ? '' : 'text-gray-400'}>
                    <td className="px-5 py-2">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{c.topups} top-ups{c.refunds ? ` · ${c.refunds} refunds` : ''}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatPaise(c.cashInPaise)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.cashRefundPaise ? `− ${formatPaise(c.cashRefundPaise)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatPaise(c.cashNetPaise)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatPaise(c.upiPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="Recent activity">
        {data.recent.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">Nothing yet.</p> : (
          <ul className="divide-y divide-gray-100">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">
                    {r.kind === 'topup' && `Top-up · ${r.method} · ${r.place}`}
                    {r.kind === 'refund' && `Cash refund · ${r.place}`}
                    {r.kind === 'sale' && `Bill #${r.billNo} · ${r.place}`}
                    {r.kind === 'reversal' && `Reversed bill #${r.billNo} · ${r.place}`}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{who(r)} · {whenTime(r.at)}</span>
                </div>
                <span className={`shrink-0 font-semibold tabular-nums ${r.kind === 'topup' || r.kind === 'reversal' ? 'text-green-700' : 'text-gray-900'}`}>
                  {r.kind === 'topup' || r.kind === 'reversal' ? '+' : '−'}{formatPaise(r.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Bills${data.bills.length >= 300 ? ' (latest 300 — the export has all)' : ''}`}>
        {data.bills.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">No bills yet.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2">Time</th>
                  <th className="px-3 py-2">Bill</th>
                  <th className="px-3 py-2">Stall</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Attendee</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                  {canReverse && <th className="px-5 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.bills.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-5 py-2 text-gray-600">{whenFull(b.at)}</td>
                    <td className="px-3 py-2 font-mono text-gray-900">#{b.billNo}</td>
                    <td className="px-3 py-2 text-gray-900">{b.stallName}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-gray-600" title={b.items}>{b.items}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{who(b)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">{formatPaise(b.totalPaise)}</td>
                    <td className="px-3 py-2"><StatusPill status={b.status} />{b.status === 'reversed' && b.reason && <span className="ml-2 text-xs text-gray-500">{b.reason}</span>}</td>
                    {canReverse && (
                      <td className="px-5 py-2 text-right">
                        {b.status === 'paid' && (
                          <button type="button" onClick={() => reverse(b)} disabled={Boolean(busyBill)} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                            {busyBill === b.id ? 'Reversing…' : 'Reverse'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
