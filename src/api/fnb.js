import api from './client'

/**
 * The F&B vertical's admin API (backend src/fnb, mounted at /admin/fnb).
 * Money is paise; lists use the standard { data, total, limit, offset }.
 */

const clean = (params = {}) => {
  const out = {}
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== null && v !== undefined) out[k] = v
  return out
}

/* ── Events ─────────────────────────────────────────────────────────── */

export const listFnbEvents = async (params) => {
  const { data } = await api.get('/admin/fnb/events', { params: clean(params) })
  return { rows: data.data ?? [], total: data.total ?? 0, limit: data.limit ?? 50, offset: data.offset ?? 0 }
}
export const createFnbEvent = async (payload) => (await api.post('/admin/fnb/events', payload)).data.event
export const getFnbEvent = async (id) => (await api.get(`/admin/fnb/events/${id}`)).data.event
export const updateFnbEvent = async (id, payload) => (await api.patch(`/admin/fnb/events/${id}`, payload)).data.event

/* ── Counter users (top-up people, stall stations) ──────────────────── */

/** → { users, canReveal } */
export const listCounterUsers = async (eventId, kind) =>
  (await api.get(`/admin/fnb/events/${eventId}/users`, { params: clean({ kind }) })).data
/** → { user, password? } — password only for admins who may reveal. */
export const createCounterUser = async (eventId, payload) =>
  (await api.post(`/admin/fnb/events/${eventId}/users`, payload)).data
/** → { created: [{ id, username, name|stall, password?, … }], canReveal }; 400 carries { errors: [{ row, reason }] } */
export const bulkCreateCounterUsers = async (eventId, kind, rows) =>
  (await api.post(`/admin/fnb/events/${eventId}/users/bulk`, { kind, rows })).data
/** Every user with passwords (administrative only; audited server-side). */
export const exportCounterUsers = async (eventId, kind) =>
  (await api.get(`/admin/fnb/events/${eventId}/users/export`, { params: clean({ kind }) })).data.users
export const disableAllCounterUsers = async (eventId, kind) =>
  (await api.post(`/admin/fnb/events/${eventId}/users/disable-all`, clean({ kind }))).data
export const revealCounterUser = async (userId) => (await api.post(`/admin/fnb/users/${userId}/reveal`)).data
export const rotateCounterUser = async (userId) => (await api.post(`/admin/fnb/users/${userId}/rotate`)).data
export const updateCounterUser = async (userId, payload) => (await api.patch(`/admin/fnb/users/${userId}`, payload)).data.user
export const deleteCounterUser = async (userId) => (await api.delete(`/admin/fnb/users/${userId}`)).data

/* ── Stalls & menus ─────────────────────────────────────────────────── */

export const listStalls = async (eventId) => (await api.get(`/admin/fnb/events/${eventId}/stalls`)).data.stalls
/** → [{ id, name, userCount, items: [...] }] */
export const getMenu = async (eventId) => (await api.get(`/admin/fnb/events/${eventId}/menu`)).data.stalls
/** rows: [{ stall, category, item, pricePaise }] → { summary, stalls }; 400 carries { errors } */
export const uploadMenu = async (eventId, rows) => (await api.put(`/admin/fnb/events/${eventId}/menu/bulk`, { rows })).data
export const createMenuItem = async (stallId, payload) => (await api.post(`/admin/fnb/stalls/${stallId}/items`, payload)).data.item
export const updateMenuItem = async (itemId, payload) => (await api.patch(`/admin/fnb/items/${itemId}`, payload)).data.item
export const deleteMenuItem = async (itemId) => (await api.delete(`/admin/fnb/items/${itemId}`)).data

/* ── Wallet settings (§1.6) ─────────────────────────────────────────── */

export const getWalletSettings = async () => (await api.get('/admin/fnb/settings')).data.settings
export const updateWalletSettings = async (payload) => (await api.put('/admin/fnb/settings', payload)).data.settings

/* ── Sales (Part 3) ─────────────────────────────────────────────────── */

/** Paginated bills for an event: params { stallId?, status?, limit, offset } → { rows, total, limit, offset } */
export const listSales = async (eventId, params) => {
  const { data } = await api.get(`/admin/fnb/events/${eventId}/sales`, { params: clean(params) })
  return { rows: data.data ?? [], total: data.total ?? 0, limit: data.limit ?? 50, offset: data.offset ?? 0 }
}
/** The only way a sale is undone (spec §3.5). → { sale, wallet } */
export const reverseSale = async (saleId, reason) => (await api.post(`/admin/fnb/sales/${saleId}/reverse`, { reason })).data

/** Row-level reasons from an all-or-nothing upload, if the error carries them. */
export const uploadErrors = (err) => err?.response?.data?.errors ?? null

/* ── Wallets (Part 5, card 4: lock / unlock) ──────────────────────────── */
export const lookupWallet = async (phone) => (await api.get('/admin/fnb/wallets', { params: { phone } })).data
export const unlockWallet = async (holderId, reason) => (await api.post(`/admin/fnb/wallets/${holderId}/unlock`, { reason })).data

/* ── Dashboard (Part 4) ───────────────────────────────────────────────── */
export const getFnbDashboard = async (eventId) => (await api.get(`/admin/fnb/events/${eventId}/dashboard`)).data
export const getFnbDashboardExport = async (eventId) => (await api.get(`/admin/fnb/events/${eventId}/dashboard/export`)).data
