/**
 * Status → badge tone, kept out of Badge.jsx so that file exports only a
 * component (mixing the two breaks fast refresh).
 *
 * One vocabulary for the whole portal: the same word is the same colour
 * wherever it appears.
 */

export const ORDER_STATUS_TONE = {
  paid: 'green',
  created: 'amber',
  failed: 'red',
  expired: 'gray',
  refunded: 'purple',
}

export const INVITATION_STATUS_TONE = {
  pending: 'amber',
  accepted: 'green',
  rejected: 'red',
}

export const CHECKED_IN_TONE = (checkedIn) => (checkedIn ? 'green' : 'gray')
