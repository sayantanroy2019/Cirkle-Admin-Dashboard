import { formatPaise } from './format'

/**
 * Deleting an event is one button with two outcomes, and the backend decides
 * which (DELETE /admin/events/:id):
 *
 *   delete — nobody has ordered, bought or asked for an invitation. Gone for
 *            good, with its categories, artists, photos, coupons and popup.
 *   cancel — anyone has. The row stays so orders, tickets and revenue keep
 *            their event; attendees stop seeing it; nothing can change.
 *
 * This module turns the preview the backend returns into the words the
 * dialog shows. Pure, so it can be unit-tested without a browser.
 */

export const REASON_MAX = 500

export const isCancelled = (event) => Boolean(event?.cancelledAt)

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * What goes with the event, as "3 artists" / "1 coupon" strings — zeros
 * dropped. Money is deliberately not here; describeOutcome() states it.
 */
export function describeDependents(counts) {
  if (!counts) return []
  return [
    [counts.categories, 'ticket category', 'ticket categories'],
    [counts.artists, 'artist'],
    [counts.photos, 'gallery photo'],
    [counts.coupons, 'coupon'],
    [counts.promoPopups, 'promo popup'],
    [counts.invitations, 'invitation'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => plural(n, one, many))
}

/**
 * The headline, the explanation and the label of the one red button, per
 * outcome. The cancel body leads with the money, because that is the number
 * someone will have to refund by hand.
 */
export function describeOutcome(preview) {
  const { outcome, counts } = preview

  if (outcome === 'cancel') {
    const parts = []
    if (counts.paidOrders > 0) {
      parts.push(
        `${plural(counts.tickets, 'ticket')} across ${plural(counts.paidOrders, 'paid order')} — ${formatPaise(counts.paidPaise)} collected, which will need refunding by hand.`,
      )
    } else if (counts.orders > 0) {
      parts.push(`${plural(counts.orders, 'order')}, none of them paid.`)
    }
    if (counts.invitations > 0) {
      parts.push(`${plural(counts.invitations, 'invitation')} requested.`)
    }
    parts.push(
      'Attendees stop seeing this event and can no longer buy into it; its orders, tickets and revenue stay in Oversight. Nothing about it can be changed afterwards, and there is no undo.',
    )
    return {
      title: 'This event will be cancelled, not deleted',
      body: parts.join(' '),
      confirmLabel: 'Cancel event',
    }
  }

  return {
    title: 'This event will be permanently deleted',
    body: 'Nobody has ordered, bought or asked for an invitation, so nothing is kept — the event and everything attached to it go for good. There is no undo.',
    confirmLabel: 'Delete permanently',
  }
}
