import api from './client'

/**
 * The reusable ticket-category catalogue — names only.
 *
 * Price, admits-count and inventory are per-event and live on the event's
 * `categories[]`, because the same name costs different amounts at different
 * events.
 *
 * Verified against Swagger and the live API on 2026-08-06.
 */

/** Sorted by name. Pass `true` for the dropdown set — retired names are hidden. */
export const listTicketCategories = async (isActive = true) => {
  const { data } = await api.get('/admin/ticket-categories', {
    params: isActive === undefined ? {} : { isActive },
  })
  return data.ticketCategories ?? []
}

/**
 * Add a name to the catalogue.
 *
 * Names are normalized server-side — trimmed and internal whitespace collapsed,
 * so `'  Couple   Pass '` stores as `'Couple Pass'`. Uniqueness is
 * **case-insensitive**: `VIP` and `vip` collide and the second gets a 409.
 */
export const createTicketCategory = async (name) => {
  const { data } = await api.post('/admin/ticket-categories', { name })
  return data.ticketCategory
}
