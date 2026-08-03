import api from './client'

/**
 * The five read-only oversight endpoints.
 *
 * Verified against Swagger and the live API on 2026-08-03. Unlike the
 * organizer/event endpoints, these are genuinely paginated: every list returns
 * `{ data, total, limit, offset }` and accepts `limit`/`offset`. `limit`
 * defaults to 50 and is clamped server-side to 100 (confirmed: asking for 500
 * comes back as 100).
 *
 * Nothing here mutates — there are no POST/PATCH/PUT/DELETE routes at all.
 * All money fields are paise.
 */

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 100

/** Drops empty filters so we never send `?status=`. */
const cleanParams = (params) => {
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = v
  }
  return out
}

const getList = async (path, params) => {
  const { data } = await api.get(path, { params: cleanParams(params) })
  return {
    rows: data.data ?? [],
    total: data.total ?? 0,
    limit: data.limit ?? DEFAULT_LIMIT,
    offset: data.offset ?? 0,
  }
}

/* ── Orders ─────────────────────────────────────────────────────────── */

/**
 * Filters: status, eventId, userId, from, to.
 *
 * `from`/`to` are compared directly against `created_at`, so a bare date is
 * read as that day at 00:00 — asking for from=28th&to=28th returns nothing,
 * because every order that day is after midnight. `dayRangeToInstants` below
 * converts the admin's chosen local days into explicit UTC instants covering
 * the whole day.
 */
export const listOrders = (params) => getList('/admin/orders', params)

export const getOrder = async (id) => {
  const { data } = await api.get(`/admin/orders/${id}`)
  return data.order
}

/**
 * `<input type="date">` gives a local calendar day. Turn a from/to pair into
 * the UTC instants that actually bracket those days for the admin's timezone.
 */
export const dayRangeToInstants = ({ from, to }) => {
  const out = {}
  if (from) {
    const d = new Date(`${from}T00:00:00`)
    if (!Number.isNaN(d.getTime())) out.from = d.toISOString()
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`)
    if (!Number.isNaN(d.getTime())) out.to = d.toISOString()
  }
  return out
}

/* ── Tickets ────────────────────────────────────────────────────────── */

/** Filters: eventId, checkedIn ('true' | 'false'), userId. */
export const listTickets = (params) => getList('/admin/tickets', params)

export const getTicket = async (id) => {
  const { data } = await api.get(`/admin/tickets/${id}`)
  return data.ticket
}

/* ── Revenue ────────────────────────────────────────────────────────── */

/**
 * Overall totals, computed from paid orders only.
 *
 * `refundedPaise` is deliberately NOT deducted from the collected figures —
 * the UI must show it alongside, never netted in.
 */
export const getRevenue = async () => {
  const { data } = await api.get('/admin/revenue')
  return data
}

/** Same breakdown per event. Paginated; includes events with zero revenue. */
export const listRevenueByEvent = (params) => getList('/admin/revenue/by-event', params)

/* ── Invitations ────────────────────────────────────────────────────── */

/** Filters: eventId, status ('pending' | 'accepted' | 'rejected'), userId. */
export const listInvitations = (params) => getList('/admin/invitations', params)

/* ── Users ──────────────────────────────────────────────────────────── */

/** `search` matches phone, email, first and last name — partial, case-insensitive. */
export const listUsers = (params) => getList('/admin/users', params)

export const getUser = async (id) => {
  const { data } = await api.get(`/admin/users/${id}`)
  return data.user
}
