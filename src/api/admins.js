import api from './client'

/**
 * Admin account management — the portal's only role-gated area.
 *
 * Every route here requires the `manage_admins` capability, which only the
 * `administrative` role has. A business_development admin gets 403 from all
 * three, regardless of what the UI shows.
 *
 * Verified against Swagger and the route source on 2026-08-03. Responses are
 * enveloped (`{ admins }` / `{ admin }`), there is no pagination, and an admin
 * reads: { id, email, displayName, role, isActive, createdAt }.
 *
 * PATCH accepts displayName, role, isActive and `password`. A body containing
 * only `password` is valid — it does not come back "No fields to update".
 * Email is not editable; it's only set at creation.
 *
 * Lockout protection is enforced server-side and returns 409 with a machine
 * code in `error` and prose in `message` (see lib/errors.js — this is the one
 * endpoint where `error` is a code rather than the human text):
 *
 *   cannot_deactivate_self      — nobody may deactivate their own account
 *   last_administrative_admin   — active administrative admins may never hit 0
 *   concurrent_admin_change     — a competing change collided; retry
 *
 * A password reset changes no counts, so the lockout rules never block it —
 * resetting your own password is always allowed.
 */

export const ADMIN_ROLES = [
  { id: 'administrative', label: 'Administrative' },
  { id: 'business_development', label: 'Business development' },
]

export const ROLE_LABELS = {
  administrative: 'Administrative',
  business_development: 'Business development',
}

export const MIN_ADMIN_PASSWORD = 8

/** Oldest first, matching the backend's ordering. */
export const listAdmins = async () => {
  const { data } = await api.get('/admin/admins')
  return data.admins ?? []
}

/** `payload` is { email, password, displayName, role }. 409 if the email is taken. */
export const createAdmin = async (payload) => {
  const { data } = await api.post('/admin/admins', payload)
  return data.admin
}

/**
 * Partial update — { displayName, role, isActive, password }, any subset.
 * A completely empty body is still a 400, so callers send only what changed and
 * short-circuit when nothing did; a password-only body is fine.
 */
export const updateAdmin = async (id, payload) => {
  const { data } = await api.patch(`/admin/admins/${id}`, payload)
  return data.admin
}
