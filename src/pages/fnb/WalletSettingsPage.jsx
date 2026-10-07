import { useEffect, useState } from 'react'
import { getWalletSettings, updateWalletSettings } from '../../api/fnb'
import useAsync from '../../hooks/useAsync'
import { useIsAdministrative } from '../../store/authStore'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, paiseToRupeeInput, rupeeInputToPaise } from '../../lib/format'
import PageHeader from '../../components/PageHeader'
import Field from '../../components/Field'
import Button from '../../components/Button'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'

/**
 * Wallet settings (spec §1.6): the money rules every F&B wallet obeys.
 * Readable by any admin with the F&B section; editable by administrative
 * admins only (the backend enforces manage_fnb_settings).
 */
const toForm = (s) => ({
  minTopup: paiseToRupeeInput(s.minTopupPaise),
  maxTopup: paiseToRupeeInput(s.maxTopupPaise),
  maxBalance: s.maxBalancePaise === null ? '' : paiseToRupeeInput(s.maxBalancePaise),
  quickAmounts: s.quickAmountsPaise.map((p) => paiseToRupeeInput(p)).join(', '),
  voidWindow: String(s.voidWindowMinutes),
  expiryHours: String(s.expiryHoursAfterEnd),
})

export default function WalletSettingsPage() {
  const { data, loading, error, reload } = useAsync(getWalletSettings)
  const canEdit = useIsAdministrative()
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (data) setForm(toForm(data)) }, [data])

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); setNotice(null) }

  const validate = () => {
    const errs = {}
    const min = rupeeInputToPaise(form.minTopup), max = rupeeInputToPaise(form.maxTopup)
    if (min === null || min <= 0) errs.minTopup = 'Enter a rupee amount above 0.'
    if (max === null || max <= 0) errs.maxTopup = 'Enter a rupee amount above 0.'
    if (min !== null && max !== null && max < min) errs.maxTopup = 'Must be at least the minimum.'
    const cap = form.maxBalance.trim() === '' ? null : rupeeInputToPaise(form.maxBalance)
    if (form.maxBalance.trim() !== '' && (cap === null || cap <= 0)) errs.maxBalance = 'Enter a rupee amount, or leave empty for no cap.'
    const quick = form.quickAmounts.split(',').map((s) => s.trim()).filter(Boolean).map(rupeeInputToPaise)
    if (quick.length === 0 || quick.length > 8 || quick.some((q) => q === null || q <= 0)) errs.quickAmounts = 'Up to 8 rupee amounts, separated by commas.'
    else if (min !== null && max !== null && quick.some((q) => q < min || q > max)) errs.quickAmounts = 'Every quick amount must be between the minimum and maximum.'
    const vw = Number(form.voidWindow), eh = Number(form.expiryHours)
    if (!Number.isInteger(vw) || vw < 0 || vw > 1440) errs.voidWindow = '0–1440 minutes.'
    if (!Number.isInteger(eh) || eh < 0 || eh > 720) errs.expiryHours = '0–720 hours.'
    return { errs, payload: { minTopupPaise: min, maxTopupPaise: max, maxBalancePaise: cap, quickAmountsPaise: quick, voidWindowMinutes: vw, expiryHoursAfterEnd: eh } }
  }

  const save = async (e) => {
    e.preventDefault()
    const { errs, payload } = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true); setNotice(null)
    try {
      await updateWalletSettings(payload)
      setNotice({ tone: 'success', text: 'Wallet settings saved. Counters pick them up on their next action.' })
      await reload()
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err, "Couldn't save the settings.") })
    } finally { setSaving(false) }
  }

  if (loading && !form) return <p className="flex items-center gap-2 py-16 text-sm text-gray-500"><Spinner />Loading wallet settings…</p>
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{errorMessage(error, "Couldn't load the wallet settings.")}</p>
        <div className="mt-4 flex justify-center gap-3"><Button variant="secondary" onClick={reload}>Try again</Button></div>
      </div>
    )
  }
  if (!form) return null

  return (
    <>
      <PageHeader title="Wallet settings" description="The rules every F&B wallet obeys — top-up limits, quick amounts, the void window and when balances expire." />
      {notice && <Alert tone={notice.tone} className="mb-4" onDismiss={() => setNotice(null)}>{notice.text}</Alert>}
      {!canEdit && <Alert tone="warning" className="mb-4">Only administrative admins can change these settings.</Alert>}

      <form onSubmit={save} className="max-w-lg space-y-5" noValidate>
        <section className="rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Top-ups</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Minimum per top-up (₹)" inputMode="decimal" value={form.minTopup} onChange={set('minTopup')} error={errors.minTopup} disabled={!canEdit || saving} />
            <Field label="Maximum per top-up (₹)" inputMode="decimal" value={form.maxTopup} onChange={set('maxTopup')} error={errors.maxTopup} disabled={!canEdit || saving} />
            <Field label="Maximum balance (₹)" inputMode="decimal" value={form.maxBalance} onChange={set('maxBalance')} error={errors.maxBalance} disabled={!canEdit || saving} placeholder="No cap" hint="Leave empty for no cap." />
            <Field label="Quick amounts (₹)" value={form.quickAmounts} onChange={set('quickAmounts')} error={errors.quickAmounts} disabled={!canEdit || saving} hint="Comma-separated, up to 8 — the buttons on the Recharge screen." />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900">Reversals and expiry</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Void window (minutes)" inputMode="numeric" value={form.voidWindow} onChange={set('voidWindow')} error={errors.voidWindow} disabled={!canEdit || saving}
              hint="How long a volunteer may reverse their own top-up, if unspent. After that: admin only." />
            <Field label="Balance expiry (hours after event end)" inputMode="numeric" value={form.expiryHours} onChange={set('expiryHours')} error={errors.expiryHours} disabled={!canEdit || saving}
              hint="Balances drop to zero this long after an event is set to Ended." />
          </div>
        </section>

        {canEdit && (
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
            <span className="text-xs text-gray-500">Last changed {formatDateTime(data.updatedAt)}</span>
          </div>
        )}
      </form>
    </>
  )
}
