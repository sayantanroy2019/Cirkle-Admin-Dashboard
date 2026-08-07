import { isForbidden, isNetworkError } from '../api/client'

/**
 * A human message for a failed request.
 *
 * Most endpoints put human prose straight in `{ error }`. The admin lockout
 * 409s are the exception: there `error` is a **machine code**
 * (`cannot_deactivate_self`, `last_administrative_admin`,
 * `concurrent_admin_change`) and the prose lives in `message`. So `message`
 * wins when present — otherwise the UI would show an admin a raw enum value.
 *
 * We surface the server's own wording only for the statuses where it's specific
 * and actionable (400 validation, 409 conflict), and fall back to our own
 * elsewhere so raw server strings don't leak into the UI. 401 is deliberately
 * absent — the interceptor has already logged the admin out by the time
 * anything renders.
 */
export const errorMessage = (err, fallback = 'Something went wrong, please try again.') => {
  if (isNetworkError(err)) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  if (isForbidden(err)) {
    return "Your account doesn't have permission to do that."
  }

  const status = err?.response?.status
  const data = err?.response?.data
  const serverMessage = data?.message || data?.error

  if (status === 404) return 'Not found. It may have been removed.'
  if ((status === 400 || status === 409) && serverMessage) return serverMessage

  return fallback
}

/** The backend uses 409 for "that email is already taken". */
export const isConflict = (err) => err?.response?.status === 409

/**
 * The machine-readable code on an admin lockout 409, or null.
 *
 * Branch on this, never on the prose — the wording is free to change.
 */
export const conflictCode = (err) =>
  err?.response?.status === 409 ? (err?.response?.data?.error ?? null) : null

export const LOCKOUT_CODES = {
  CANNOT_DEACTIVATE_SELF: 'cannot_deactivate_self',
  LAST_ADMINISTRATIVE_ADMIN: 'last_administrative_admin',
  CONCURRENT_ADMIN_CHANGE: 'concurrent_admin_change',
}
