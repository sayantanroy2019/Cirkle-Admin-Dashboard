import { isForbidden, isNetworkError } from '../api/client'

/**
 * A human message for a failed request.
 *
 * The backend puts its reason in `{ error }`; we prefer that for the statuses
 * where it's specific and actionable (400 validation, 409 conflict) and fall
 * back to our own wording elsewhere so raw server strings don't leak into the
 * UI. 401 is deliberately absent — the interceptor has already logged the
 * admin out by the time anything renders.
 */
export const errorMessage = (err, fallback = 'Something went wrong, please try again.') => {
  if (isNetworkError(err)) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  if (isForbidden(err)) {
    return "Your account doesn't have permission to do that."
  }

  const status = err?.response?.status
  const serverMessage = err?.response?.data?.error

  if (status === 404) return 'Not found. It may have been removed.'
  if ((status === 400 || status === 409) && serverMessage) return serverMessage

  return fallback
}

/** The backend uses 409 for "that email is already taken". */
export const isConflict = (err) => err?.response?.status === 409
