import api from './client'

/**
 * The promo popup an event's detail page shows (flash sales, campaigns).
 * One per event, saved as a whole — PUT is an upsert. Optionally linked to
 * one of the SAME event's coupons; the consumer popup then carries the live
 * code + percent and degrades to text-only if the coupon dies.
 */

export const getEventPopup = async (eventId) => {
  const { data } = await api.get(`/admin/events/${eventId}/popup`)
  return data.popup // null when none configured
}

export const saveEventPopup = async (eventId, payload) => {
  const { data } = await api.put(`/admin/events/${eventId}/popup`, payload)
  return data.popup
}

export const deleteEventPopup = async (eventId) => {
  const { data } = await api.delete(`/admin/events/${eventId}/popup`)
  return data
}
