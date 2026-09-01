import { useEffect, useState } from 'react'
import { deleteEventPopup, getEventPopup, saveEventPopup } from '../api/promoPopup'
import { listEventCoupons } from '../api/coupons'
import { errorMessage } from '../lib/errors'
import { isoToLocalInput, localInputToIso } from '../lib/format'
import Field from './Field'
import Textarea from './Textarea'
import Select from './Select'
import Checkbox from './Checkbox'
import Button from './Button'
import Alert from './Alert'
import Spinner from './Spinner'

/**
 * The event's promo popup — shown to users the moment they land on the
 * event detail page, while Active and inside its window. One per event; the
 * whole form saves together. Linking a coupon renders its live code +
 * percent in the popup, and the popup degrades to text-only if that coupon
 * is deactivated — the code shown can never be one checkout would refuse.
 */
export default function PromoPopupCard({ eventId }) {
  const [loaded, setLoaded] = useState(false)
  const [exists, setExists] = useState(false)
  const [coupons, setCoupons] = useState([])
  const [loadError, setLoadError] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [couponId, setCouponId] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [delaySeconds, setDelaySeconds] = useState('0')
  const [active, setActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [flash, setFlash] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([getEventPopup(eventId), listEventCoupons(eventId)])
      .then(([popup, couponRows]) => {
        if (!alive) return
        setCoupons(couponRows)
        if (popup) {
          setExists(true)
          setTitle(popup.title)
          setMessage(popup.message)
          setCouponId(popup.couponId ?? '')
          setValidFrom(isoToLocalInput(popup.validFrom))
          setValidUntil(popup.validUntil ? isoToLocalInput(popup.validUntil) : '')
          setDelaySeconds(String(popup.delaySeconds ?? 0))
          setActive(popup.isActive)
        }
        setLoaded(true)
      })
      .catch((err) => alive && setLoadError(errorMessage(err, "Couldn't load the popup.")))
    return () => {
      alive = false
    }
  }, [eventId])

  const handleSave = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!title.trim() || !message.trim()) {
      setError('Title and message are both required.')
      return
    }
    if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) {
      setError('The end of the window must be after its start.')
      return
    }
    const delay = Number(delaySeconds)
    if (!Number.isInteger(delay) || delay < 0 || delay > 300) {
      setError('Delay must be a whole number of seconds, 0–300.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveEventPopup(eventId, {
        title: title.trim(),
        message: message.trim(),
        couponId: couponId || null,
        validFrom: validFrom ? localInputToIso(validFrom) : undefined,
        validUntil: validUntil ? localInputToIso(validUntil) : null,
        delaySeconds: delay,
        isActive: active,
      })
      setExists(true)
      setFlash(active ? 'Popup saved — live to users now (inside its window).' : 'Popup saved as inactive.')
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the popup."))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Remove this popup entirely?')) return
    setDeleting(true)
    setError('')
    try {
      await deleteEventPopup(eventId)
      setExists(false)
      setTitle('')
      setMessage('')
      setCouponId('')
      setValidFrom('')
      setValidUntil('')
      setActive(true)
      setFlash('Popup removed.')
    } catch (err) {
      setError(errorMessage(err, "Couldn't remove the popup."))
    } finally {
      setDeleting(false)
    }
  }

  if (loadError) return <Alert tone="error">{loadError}</Alert>
  if (!loaded) return <Spinner />

  const couponOptions = coupons.map((c) => ({
    id: c.id,
    label: `${c.code} · ${c.discountPercent}% off${c.isActive ? '' : ' (inactive)'}`,
  }))

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {flash && (
        <Alert tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}
      {error && (
        <Alert tone="error" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="⚡ Flash Sale"
          autoComplete="off"
        />
        <Select
          label="Attach a coupon"
          value={couponId}
          onChange={(e) => setCouponId(e.target.value)}
          options={couponOptions}
          placeholder="None — text only"
          hint="The popup shows the live code and % automatically; it hides the code if the coupon is deactivated."
        />
        <Textarea
          label="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder="30% off for the next 48 hours."
          className="sm:col-span-2"
        />
        <Field
          label="Show from"
          type="datetime-local"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          hint="Empty = immediately."
        />
        <Field
          label="Show until"
          type="datetime-local"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          hint="Empty = until you turn it off."
        />
        <Field
          label="Show after (seconds)"
          type="number"
          min="0"
          max="300"
          value={delaySeconds}
          onChange={(e) => setDelaySeconds(e.target.value)}
          hint="How long someone is on the page before the popup appears. 0 = right away."
        />
      </div>

      <Checkbox
        label="Active — users landing on this event see the popup (once per session)"
        checked={active}
        onChange={(e) => setActive(e.target.checked)}
      />

      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {exists ? 'Save popup' : 'Create popup'}
        </Button>
        {exists && (
          <Button type="button" variant="caution" loading={deleting} onClick={handleDelete}>
            Remove popup
          </Button>
        )}
      </div>
    </form>
  )
}
