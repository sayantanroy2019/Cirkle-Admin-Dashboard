import { useEffect, useState } from 'react'
import {
  createEventCoupon,
  deleteCoupon,
  listEventCoupons,
  updateCoupon,
} from '../api/coupons'
import { errorMessage } from '../lib/errors'
import {
  formatDateTime,
  formatPaise,
  isoToLocalInput,
  localInputToIso,
  paiseToRupeeInput,
  rupeeInputToPaise,
} from '../lib/format'
import Field from './Field'
import Button from './Button'
import Alert from './Alert'
import Spinner from './Spinner'

/**
 * Percentage coupons for one event (COUPON-CODES.md).
 *
 * A coupon works only on this event and only inside its validity window —
 * both enforced by the backend; this UI just makes them visible. The Active
 * toggle is the kill switch for a leaked code; Delete exists only while a
 * coupon has never been used.
 */

const CODE_PATTERN = /^[A-Za-z0-9-]{3,20}$/

const EMPTY_FORM = {
  code: '',
  percent: '',
  maxRupees: '',
  validFrom: '',
  validUntil: '',
  limitTotal: '',
  limitPerUser: '1',
  active: true,
}

function windowLabel(coupon) {
  const from = coupon.validFrom ? formatDateTime(coupon.validFrom) : null
  const until = coupon.validUntil ? formatDateTime(coupon.validUntil) : null
  if (from && until) return `${from} → ${until}`
  if (until) return `until ${until}`
  if (from) return `from ${from} · no expiry`
  return 'no expiry'
}

export default function CouponManager({ eventId }) {
  const [coupons, setCoupons] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [flash, setFlash] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [showForm, setShowForm] = useState(false)
  // null = the form is creating; a coupon id = the form is editing that row.
  const [editingId, setEditingId] = useState(null)
  const [editingCode, setEditingCode] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  useEffect(() => {
    let active = true
    listEventCoupons(eventId)
      .then((rows) => active && setCoupons(rows))
      .catch((err) => active && setLoadError(errorMessage(err, "Couldn't load coupons.")))
    return () => {
      active = false
    }
  }, [eventId])

  const validateForm = () => {
    const errors = {}
    if (!CODE_PATTERN.test(form.code.trim())) {
      errors.code = '3–20 characters: letters, numbers, hyphens.'
    }
    const percent = Number(form.percent)
    if (!Number.isInteger(percent) || percent < 1 || percent > 99) {
      errors.percent = 'A whole number from 1 to 99.'
    }
    if (form.maxRupees.trim() !== '') {
      const paise = rupeeInputToPaise(form.maxRupees)
      if (!paise || paise <= 0) errors.maxRupees = 'A positive ₹ amount, or leave empty.'
    }
    if (form.validFrom && form.validUntil && new Date(form.validUntil) <= new Date(form.validFrom)) {
      errors.validUntil = 'Must be after the start.'
    }
    for (const key of ['limitTotal', 'limitPerUser']) {
      if (form[key].trim() === '' && key === 'limitTotal') continue
      const n = Number(form[key])
      if (!Number.isInteger(n) || n <= 0) {
        errors[key] = 'A positive whole number.'
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setEditingCode('')
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  // Prefill the shared form from an existing row. Same fields, same
  // validation — only the submit differs (PATCH instead of POST).
  const handleEdit = (coupon) => {
    setEditingId(coupon.id)
    setEditingCode(coupon.code)
    setForm({
      code: coupon.code,
      percent: String(coupon.discountPercent ?? ''),
      maxRupees: coupon.maxDiscountPaise ? paiseToRupeeInput(coupon.maxDiscountPaise) : '',
      validFrom: coupon.validFrom ? isoToLocalInput(coupon.validFrom) : '',
      validUntil: coupon.validUntil ? isoToLocalInput(coupon.validUntil) : '',
      limitTotal: coupon.usageLimitTotal ? String(coupon.usageLimitTotal) : '',
      limitPerUser: String(coupon.usageLimitPerUser ?? 1),
      active: coupon.isActive,
    })
    setFormErrors({})
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving || !validateForm()) return
    setSaving(true)
    setActionError('')
    const payload = {
      code: form.code.trim(),
      discountPercent: Number(form.percent),
      // null clears the optional fields on PATCH; on POST it means "none".
      maxDiscountPaise: form.maxRupees.trim() === '' ? null : rupeeInputToPaise(form.maxRupees),
      // Empty "valid from" means "now" on create and "leave unchanged" on
      // edit — valid_from is NOT NULL in the schema, so it can't be cleared.
      validFrom: form.validFrom ? localInputToIso(form.validFrom) : undefined,
      validUntil: form.validUntil ? localInputToIso(form.validUntil) : editingId ? null : undefined,
      usageLimitTotal: form.limitTotal.trim() === '' ? null : Number(form.limitTotal),
      usageLimitPerUser: Number(form.limitPerUser),
      isActive: form.active,
    }
    try {
      if (editingId) {
        const updated = await updateCoupon(editingId, payload)
        setCoupons((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...updated } : c)))
        setFlash(`Coupon ${updated.code} updated.`)
      } else {
        const created = await createEventCoupon(eventId, payload)
        setCoupons((prev) => [created, ...(prev ?? [])])
        setFlash(`Coupon ${created.code} created.`)
      }
      closeForm()
    } catch (err) {
      setActionError(errorMessage(err, editingId ? "Couldn't update the coupon." : "Couldn't create the coupon."))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (coupon) => {
    setBusyId(coupon.id)
    setActionError('')
    try {
      const updated = await updateCoupon(coupon.id, { isActive: !coupon.isActive })
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, ...updated } : c)))
      setFlash(updated.isActive ? `${coupon.code} is live.` : `${coupon.code} deactivated.`)
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't update the coupon."))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (coupon) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete coupon ${coupon.code}? This can't be undone.`)) return
    setBusyId(coupon.id)
    setActionError('')
    try {
      await deleteCoupon(coupon.id)
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id))
      setFlash(`${coupon.code} deleted.`)
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't delete the coupon."))
    } finally {
      setBusyId(null)
    }
  }

  if (loadError) return <Alert tone="error">{loadError}</Alert>
  if (!coupons) return <Spinner />

  return (
    <div className="space-y-4">
      {flash && (
        <Alert tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}
      {actionError && (
        <Alert tone="error" onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {coupons.length === 0 && !showForm && (
        <p className="text-sm text-gray-500">
          No coupons yet. A coupon works only on this event, only inside its validity window.
        </p>
      )}

      {coupons.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-900">{coupon.code}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {coupon.isActive ? 'Active' : 'Off'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {coupon.discountPercent}% off
                  {coupon.maxDiscountPaise ? ` · up to ${formatPaise(coupon.maxDiscountPaise)}` : ''}
                  {' · '}
                  {windowLabel(coupon)}
                  {' · used '}
                  {coupon.usedCount}
                  {coupon.usageLimitTotal ? ` / ${coupon.usageLimitTotal}` : ''}
                  {` · ${coupon.usageLimitPerUser}/user`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" onClick={() => handleEdit(coupon)}>
                  Edit
                </Button>
                <Button
                  variant={coupon.isActive ? 'caution' : 'secondary'}
                  loading={busyId === coupon.id}
                  onClick={() => handleToggle(coupon)}
                >
                  {coupon.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                {coupon.usedCount === 0 && (
                  <Button
                    variant="caution"
                    loading={busyId === coupon.id}
                    onClick={() => handleDelete(coupon)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 p-4">
          {editingId && (
            <p className="text-sm font-medium text-gray-700">
              Editing <span className="font-mono font-semibold">{editingCode}</span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Code"
              value={form.code}
              onChange={setField('code')}
              error={formErrors.code}
              hint="What buyers type at checkout. Saved uppercase; unique across all events."
              placeholder="SAVE20"
              autoComplete="off"
            />
            <Field
              label="Discount %"
              type="number"
              min="1"
              max="99"
              value={form.percent}
              onChange={setField('percent')}
              error={formErrors.percent}
              hint="1–99. GST is charged on the discounted price."
              placeholder="20"
            />
            <Field
              label="Maximum discount (₹)"
              value={form.maxRupees}
              onChange={setField('maxRupees')}
              error={formErrors.maxRupees}
              hint="Optional cap — e.g. 20% off up to ₹200. Empty = no cap."
              placeholder="200"
            />
            <Field
              label="Total uses"
              value={form.limitTotal}
              onChange={setField('limitTotal')}
              error={formErrors.limitTotal}
              hint="Optional — e.g. first 100 uses. Empty = unlimited."
              placeholder="100"
            />
            <Field
              label="Valid from"
              type="datetime-local"
              value={form.validFrom}
              onChange={setField('validFrom')}
              error={formErrors.validFrom}
              hint="Empty = active immediately."
            />
            <Field
              label="Valid until"
              type="datetime-local"
              value={form.validUntil}
              onChange={setField('validUntil')}
              error={formErrors.validUntil}
              hint="Empty = no expiry."
            />
            <Field
              label="Uses per user"
              type="number"
              min="1"
              value={form.limitPerUser}
              onChange={setField('limitPerUser')}
              error={formErrors.limitPerUser}
              hint="How many times one person can use it."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            Active immediately — untick to prepare the coupon now and switch it on later
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {editingId ? 'Save changes' : 'Create coupon'}
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setEditingId(null)
            setEditingCode('')
            setForm(EMPTY_FORM)
            setShowForm(true)
          }}
        >
          Add coupon
        </Button>
      )}
    </div>
  )
}
