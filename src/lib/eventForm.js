import { isoToLocalInput, localInputToIso, paiseToRupeeInput, rupeeInputToPaise } from './format'

/**
 * Shared shape, validation and payload-building for the event form, so create
 * and edit can't drift apart.
 *
 * Form state is all strings (what inputs give us). Conversion to API types —
 * rupees→paise, local datetime→ISO, ""→null — happens only in the two payload
 * builders at the bottom.
 *
 * Rules mirror the backend's validateEventFields:
 *   name, categoryId, cityId, startsAt, price, targetGroupSize are required on
 *   create; price/capacity/targetGroupSize are integers; capacity and
 *   targetGroupSize must be > 0; price >= 0; startsAt must be in the future,
 *   but only when it's actually being sent.
 */

export const EVENT_TYPE_OPTIONS = [
  { id: 'open', label: 'Open — anyone can book' },
  { id: 'invite_only', label: 'Invite-only — attendees need an invitation' },
]

export const emptyEventForm = () => ({
  name: '',
  organizerId: '',
  categoryId: '',
  cityId: '',
  startsAt: '',
  endsAt: '',
  price: '',
  capacity: '',
  targetGroupSize: '',
  eventType: 'open',
  venueName: '',
  venueAddress: '',
  description: '',
})

/** An API event → form strings. Nulls become '' so inputs stay controlled. */
export const eventToForm = (event) => ({
  name: event.name ?? '',
  organizerId: event.organizerId ?? '',
  categoryId: event.categoryId ?? '',
  cityId: event.cityId ?? '',
  startsAt: isoToLocalInput(event.startsAt),
  endsAt: isoToLocalInput(event.endsAt),
  price: paiseToRupeeInput(event.price),
  capacity: event.capacity === null || event.capacity === undefined ? '' : String(event.capacity),
  targetGroupSize:
    event.targetGroupSize === null || event.targetGroupSize === undefined
      ? ''
      : String(event.targetGroupSize),
  eventType: event.eventType ?? 'open',
  venueName: event.venueName ?? '',
  venueAddress: event.venueAddress ?? '',
  description: event.description ?? '',
})

const parsePositiveInt = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

/**
 * `requireAll` — true on create, false on edit (where untouched fields are
 * simply not sent).
 * `enforceFutureStart` — the backend only rejects a past startsAt when the
 * field is in the request body, so edit passes false unless the date changed.
 */
export const validateEventForm = (form, { requireAll, enforceFutureStart }) => {
  const errors = {}

  if (requireAll || form.name !== undefined) {
    if (!form.name.trim()) errors.name = 'Enter an event name.'
  }
  if (requireAll) {
    if (!form.categoryId) errors.categoryId = 'Choose a category.'
    if (!form.cityId) errors.cityId = 'Choose a city.'
    if (!form.startsAt) errors.startsAt = 'Choose when the event starts.'
  }

  if (form.startsAt) {
    const iso = localInputToIso(form.startsAt)
    if (!iso) {
      errors.startsAt = 'That date and time isn’t valid.'
    } else if (enforceFutureStart && new Date(iso).getTime() <= Date.now()) {
      errors.startsAt = 'The start date and time must be in the future.'
    }
  }

  if (form.endsAt) {
    const endIso = localInputToIso(form.endsAt)
    const startIso = localInputToIso(form.startsAt)
    if (!endIso) {
      errors.endsAt = 'That date and time isn’t valid.'
    } else if (startIso && new Date(endIso) <= new Date(startIso)) {
      // Not a backend rule, but an end before the start is always a mistake.
      errors.endsAt = 'The end must be after the start.'
    }
  }

  if (requireAll && !String(form.price).trim()) {
    errors.price = 'Enter a ticket price.'
  } else if (String(form.price).trim()) {
    const paise = rupeeInputToPaise(form.price)
    if (paise === null) errors.price = 'Enter a valid amount in rupees.'
  }

  if (requireAll && !String(form.targetGroupSize).trim()) {
    errors.targetGroupSize = 'Enter a target group size.'
  } else if (String(form.targetGroupSize).trim()) {
    const n = parsePositiveInt(form.targetGroupSize)
    if (Number.isNaN(n)) errors.targetGroupSize = 'Enter a whole number above zero.'
  }

  if (String(form.capacity).trim()) {
    const n = parsePositiveInt(form.capacity)
    if (Number.isNaN(n)) errors.capacity = 'Enter a whole number above zero, or leave blank for uncapped.'
  }

  return errors
}

/** Everything the create endpoint wants, with API types. */
export const formToCreatePayload = (form) => ({
  name: form.name.trim(),
  categoryId: form.categoryId,
  cityId: form.cityId,
  startsAt: localInputToIso(form.startsAt),
  endsAt: form.endsAt ? localInputToIso(form.endsAt) : null,
  price: rupeeInputToPaise(form.price),
  capacity: String(form.capacity).trim() ? Number(form.capacity) : null,
  targetGroupSize: Number(form.targetGroupSize),
  eventType: form.eventType,
  venueName: form.venueName.trim() || null,
  venueAddress: form.venueAddress.trim() || null,
  description: form.description.trim() || null,
  // Swagger allows null — an event can be created unassigned and linked later.
  organizerId: form.organizerId || null,
})

/**
 * Only the fields that actually differ from `original`, in API types.
 *
 * An empty result means "nothing changed" — the caller must short-circuit
 * rather than send it, because an empty PATCH body is a 400.
 */
export const changedEventFields = (form, original) => {
  const current = formToCreatePayload(form)
  const baseline = formToCreatePayload(eventToForm(original))

  const payload = {}
  for (const [key, value] of Object.entries(current)) {
    // startsAt/endsAt round-trip through local-input strings on both sides, so
    // comparing the built payloads avoids false diffs from formatting alone.
    if (value !== baseline[key]) payload[key] = value
  }
  return payload
}
