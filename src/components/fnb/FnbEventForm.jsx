import { useEffect, useState } from 'react'
import { listOrganizers } from '../../api/organizers'
import { listEvents } from '../../api/events'
import { listCities } from '../../api/reference'
import useAsync from '../../hooks/useAsync'
import { isoToLocalInput, localInputToIso } from '../../lib/format'
import Field from '../Field'
import Select from '../Select'

export const EVENT_CODE_RE = /^[a-z0-9]{2,8}$/

/** Form state from an event (or blank). */
export const eventToForm = (e) => ({
  name: e?.name ?? '',
  code: e?.code ?? '',
  organizerId: e?.organizer?.id ?? '',
  linkedEventId: e?.linkedEvent?.id ?? '',
  cityId: e?.cityId ?? '',
  venueName: e?.venueName ?? '',
  venueAddress: e?.venueAddress ?? '',
  startsAt: e?.startsAt ? isoToLocalInput(e.startsAt) : '',
  endsAt: e?.endsAt ? isoToLocalInput(e.endsAt) : '',
})

export const validateForm = (f) => {
  const errs = {}
  if (!f.name.trim()) errs.name = 'Enter the event name.'
  const code = f.code.trim().toLowerCase()
  if (!code) errs.code = 'Enter a short event code.'
  else if (!EVENT_CODE_RE.test(code)) errs.code = '2–8 lowercase letters or digits, e.g. neon.'
  if (f.startsAt && f.endsAt && new Date(f.endsAt) < new Date(f.startsAt)) errs.endsAt = 'End must be after start.'
  return errs
}

/** API payload from form state. Empty links/dates are sent as null to clear. */
export const formToPayload = (f) => ({
  name: f.name.trim(),
  code: f.code.trim().toLowerCase(),
  organizerId: f.organizerId || null,
  linkedEventId: f.linkedEventId || null,
  cityId: f.cityId || null,
  venueName: f.venueName.trim() || null,
  venueAddress: f.venueAddress.trim() || null,
  startsAt: f.startsAt ? localInputToIso(f.startsAt) : null,
  endsAt: f.endsAt ? localInputToIso(f.endsAt) : null,
})

/**
 * The F&B event's fields (spec §1.1). The organizer field is also the
 * "Dashboard access" of §1.5: the linked organizer account is who sees this
 * event in the organizer dashboard's F&B section.
 */
export default function FnbEventForm({ form, errors, onChange, disabled, isEdit = false }) {
  const organizers = useAsync(listOrganizers, [])
  const events = useAsync(listEvents, [])
  const cities = useAsync(listCities, [])
  const [codeTouched, setCodeTouched] = useState(isEdit)

  const set = (key) => (e) => onChange(key, e.target.value)

  // On create, suggest a code from the name until the admin edits it.
  useEffect(() => {
    if (codeTouched || isEdit) return
    const suggestion = form.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    onChange('code', suggestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name])

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Event name" value={form.name} onChange={set('name')} error={errors.name} disabled={disabled} placeholder="Neon Lights — Food Court" />
      <Field
        label="Event code"
        value={form.code}
        onChange={(e) => { setCodeTouched(true); onChange('code', e.target.value.toLowerCase()) }}
        error={errors.code}
        disabled={disabled}
        placeholder="neon"
        hint="2–8 lowercase letters/digits. Generated counter usernames start with it: neon-rahul, neon-chai."
        autoComplete="off"
      />

      <Select
        label="Organizer (dashboard access)"
        value={form.organizerId}
        onChange={set('organizerId')}
        options={(organizers.data ?? []).map((o) => ({ id: o.id, label: o.displayName }))}
        placeholder="No organizer yet"
        disabled={disabled || organizers.loading}
        hint="The organizer account that sees this event's live collections in their dashboard."
      />
      <Select
        label="Linked Cirkle event (optional)"
        value={form.linkedEventId}
        onChange={set('linkedEventId')}
        options={(events.data ?? []).map((e) => ({ id: e.id, label: e.name }))}
        placeholder="Not linked to a ticketed event"
        disabled={disabled || events.loading}
        hint="Only if this food court belongs to a ticketed Cirkle event. Nothing is shared through the link today."
      />

      <Select
        label="City (optional)"
        value={form.cityId}
        onChange={set('cityId')}
        options={cities.data ?? []}
        placeholder="—"
        disabled={disabled || cities.loading}
      />
      <Field label="Venue name (optional)" value={form.venueName} onChange={set('venueName')} disabled={disabled} />
      <Field label="Venue address (optional)" value={form.venueAddress} onChange={set('venueAddress')} disabled={disabled} className="md:col-span-2" />

      <Field type="datetime-local" label="Start (reference only)" value={form.startsAt} onChange={set('startsAt')} disabled={disabled}
        hint="Recorded for reference. Nothing enforces it — counters transact whenever the event is Live." />
      <Field type="datetime-local" label="End (reference only)" value={form.endsAt} onChange={set('endsAt')} error={errors.endsAt} disabled={disabled} />
    </div>
  )
}
