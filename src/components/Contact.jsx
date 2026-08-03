/**
 * Every rendering of a user's phone or email in the portal goes through here.
 *
 * The backend currently returns both unmasked to all admins, and funnels that
 * exposure through two serializers so a future `view_pii` capability is a
 * one-place change server-side. This mirrors that discipline on the client: if
 * masking ever needs to happen (or be indicated) in the UI, it happens in this
 * file rather than in a dozen table cells.
 */

export function Phone({ value, className = '' }) {
  if (!value) return <span className="text-gray-400">—</span>
  return (
    <span className={`tabular-nums ${className}`} title={value}>
      {value}
    </span>
  )
}

export function Email({ value, className = '' }) {
  if (!value) return <span className="text-gray-400">—</span>
  return (
    <span className={className} title={value}>
      {value}
    </span>
  )
}
