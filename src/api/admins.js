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
 * Two capability gaps worth knowing, both confirmed in the implementation:
 *
 *  1. There is no `GET /admin/admins/:id`. The edit screen sources its record
 *     from the list.
 *  2. PATCH accepts only displayName, role and isActive. It does NOT accept
 *     `password` — the handler never reads it, so sending one is silently
 *     ignored (and a body containing only a password comes back 400 "No fields
 *     to update"). There is therefore no way to reset an admin's password
 *     through the API, and the UI must not pretend otherwise.
 *
 * Email is not editable either — only set at creation.
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
 * Partial update — only { displayName, role, isActive } are supported.
 * An empty body is a 400, so callers send only what changed and short-circuit
 * when nothing did.
 */
export const updateAdmin = async (id, payload) => {
  const { data } = await api.patch(`/admin/admins/${id}`, payload)
  return data.admin
}
