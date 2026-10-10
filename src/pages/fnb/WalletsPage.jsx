import { useState } from 'react'
import { lookupWallet, unlockWallet } from '../../api/fnb'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatPaise } from '../../lib/format'
import PageHeader from '../../components/PageHeader'
import Field from '../../components/Field'
import Button from '../../components/Button'
import Alert from '../../components/Alert'

/**
 * Wallets (spec Part 5, card 4): look an attendee's wallet up by phone, see
 * whether it is locked and what it holds, and UNLOCK it for someone who
 * lost access to the app (decision 10). Locking is the attendee's own act.
 */
const LockState = ({ locked }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${locked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
    {locked ? 'Locked' : 'Unlocked'}
  </span>
)

export default function WalletsPage() {
  // Unlock needs manage_fnb; every admin who can open this section has it,
  // and the backend enforces it regardless.
  const canManage = true
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [unlocking, setUnlocking] = useState(false)

  const search = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setNotice(null)
    setResult(null)
    try {
      setResult(await lookupWallet(phone.trim()))
    } catch (err) {
      setNotice({ tone: 'error', text: err?.response?.status === 404 ? 'No wallet for that number.' : errorMessage(err) })
    } finally {
      setLoading(false)
    }
  }

  const unlock = async () => {
    const reason = window.prompt('Why is this wallet being unlocked? (the attendee is told on WhatsApp; this is audited)')
    if (reason === null) return
    if (!reason.trim()) { setNotice({ tone: 'error', text: 'A reason is required.' }); return }
    setUnlocking(true)
    setNotice(null)
    try {
      setResult(await unlockWallet(result.holder.id, reason.trim()))
      setNotice({ tone: 'success', text: 'Wallet unlocked. The attendee has been told on WhatsApp.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setUnlocking(false)
    }
  }

  const h = result?.holder

  return (
    <div>
      <PageHeader title="Wallets" description="Look up an attendee's wallet by phone number. Unlock it here if they locked it and cannot get back into the app." />

      <form onSubmit={search} className="flex max-w-md items-end gap-3">
        <div className="flex-1">
          <Field label="Attendee's phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" autoComplete="off" />
        </div>
        <Button type="submit" loading={loading} disabled={!phone.trim()}>Look up</Button>
      </form>

      {notice && (
        <Alert tone={notice.tone} className="mt-4 max-w-2xl" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {h && (
        <div className="mt-6 grid max-w-3xl gap-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {h.firstName ? `${h.firstName} · ` : ''}{h.phoneMasked}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {h.isCirkleUser ? 'Cirkle user' : 'No Cirkle account yet'} · QR generation {h.qrGeneration} · wallet since {formatDateTime(h.createdAt)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <LockState locked={h.locked} />
                  {h.locked && <span className="text-xs text-gray-500">by the {h.lockedBy} on {formatDateTime(h.lockedAt)}</span>}
                </div>
              </div>
              {h.locked && canManage && (
                <Button variant="secondary" onClick={unlock} loading={unlocking}>Unlock wallet</Button>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-semibold text-gray-900">Balances</h2>
            {result.wallets.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No event wallet yet — nothing has been topped up.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-2">Event</th>
                    <th className="px-5 py-2">Status</th>
                    <th className="px-5 py-2 text-right">Balance</th>
                    <th className="px-5 py-2">Valid till</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.wallets.map((w) => (
                    <tr key={w.eventId}>
                      <td className="px-5 py-2 text-gray-900">{w.eventName}</td>
                      <td className="px-5 py-2 capitalize text-gray-600">{w.expired ? 'expired' : w.status}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-gray-900">{formatPaise(w.balancePaise)}</td>
                      <td className="px-5 py-2 text-gray-600">{w.expired ? '—' : w.validTill ? formatDateTime(w.validTill) : 'live'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-semibold text-gray-900">Lock history</h2>
            {result.lockLog.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">Never locked.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {result.lockLog.map((l, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 px-5 py-2.5 text-sm">
                    <span className="text-gray-900">
                      <span className="font-medium capitalize">{l.action}</span> by the {l.by}
                      {l.reason && <span className="text-gray-500"> — {l.reason}</span>}
                    </span>
                    <span className="shrink-0 text-gray-500">{formatDateTime(l.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
