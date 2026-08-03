import api from './client'

/**
 * Organizer endpoints.
 *
 * The backend wraps every organizer response in an envelope — `{ organizers }`
 * for the list, `{ organizer }` for the singular ones. Unwrapping happens here
 * and nowhere else, so the pages only ever see plain objects.
 *
 * Verified against the live API on 2026-08-03. An organizer reads:
 *   { id, email, displayName, instagram, isActive, createdAt, eventCount }
 * There is no `updatedAt` in any response, and `password_hash` never appears.
 *
 * `instagram` is an optional bare handle. Both create and update accept it —
 * Swagger's request bodies don't list it, but the implementation reads it on
 * POST and PATCH (verified live). It's normalized server-side: a profile URL,
 * an @handle or a bare handle all store bare, '' or null clears it, and
 * anything implausible is rejected with 400 "Invalid Instagram handle".
 */

/**
 * Every organizer, oldest first.
 *
 * NOTE: this endpoint takes no pagination. It ignores `limit`/`offset` and
 * returns the full table with no `{ total, limit, offset }` envelope — so the
 * list page paginates client-side. If the backend grows real pagination, this
 * function and OrganizersPage's slice are the only places to change.
 */
export const listOrganizers = async () => {
  const { data } = await api.get('/admin/organizers')
  return data.organizers ?? []
}

export const getOrganizer = async (id) => {
  const { data } = await api.get(`/admin/organizers/${id}`)
  return data.organizer
}

/** `payload` is { email, password, displayName }. 409 if the email is taken. */
export const createOrganizer = async (payload) => {
  const { data } = await api.post('/admin/organizers', payload)
  return data.organizer
}

/**
 * Partial update — any subset of { displayName, email, password, isActive }.
 *
 * 409 if the new email belongs to another organizer, 400 if `payload` is empty.
 *
 * Careful: the PATCH response omits `eventCount` (the UPDATE ... RETURNING
 * doesn't compute it), so callers must merge this into the organizer they
 * already hold rather than replacing it wholesale.
 */
export const updateOrganizer = async (id, payload) => {
  const { data } = await api.patch(`/admin/organizers/${id}`, payload)
  return data.organizer
}
