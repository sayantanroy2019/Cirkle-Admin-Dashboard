/**
 * Client-side mirror of the backend's `normalizeInstagram`.
 *
 * The backend normalizes and validates on write regardless — this exists so the
 * field shows the bare handle as soon as the admin leaves it, instead of them
 * saving a pasted profile URL and only then seeing it change shape. The server
 * remains the authority; if these ever disagree, the server wins.
 *
 * Accepts a bare handle, an @handle, or a full profile URL (with or without
 * protocol, www., tracking params or a trailing slash). Empty means "no handle".
 */

/** Instagram's own rule: letters, digits, underscore, period; max 30. */
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/

/** Strips everything decorative, returning the bare handle or ''. */
export const toBareHandle = (raw) => {
  if (raw === null || raw === undefined) return ''
  return String(raw)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/[?#].*$/, '') // drop ?igsh=… tracking params
    .replace(/\/+$/, '') // drop trailing slashes
    .replace(/^@+/, '') // drop a leading @, after the URL strip
}

/** True when a non-empty value can't be a handle. Empty is always fine — it's optional. */
export const isInvalidHandle = (raw) => {
  const handle = toBareHandle(raw)
  return handle !== '' && !HANDLE_RE.test(handle)
}

/** What to send the API: the bare handle, or null to clear. */
export const handleForApi = (raw) => toBareHandle(raw) || null

export const INSTAGRAM_ERROR =
  'Enter a handle like cirkle.live, or paste the profile link.'

/** The public profile URL for a stored bare handle. */
export const instagramUrl = (handle) => `https://instagram.com/${handle}`
