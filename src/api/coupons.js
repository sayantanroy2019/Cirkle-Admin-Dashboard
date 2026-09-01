import api from './client'

/**
 * Discount coupons — percentage-off codes bound to ONE event (created from
 * that event's detail page; the backend takes the event from the URL, so a
 * coupon can never be created unscoped or moved later).
 *
 * Verified against the backend on 2026-09-01 (COUPON-CODES.md).
 */

/** Newest first, each with usedCount (confirmed redemptions). */
export const listEventCoupons = async (eventId) => {
  const { data } = await api.get(`/admin/events/${eventId}/coupons`)
  return data.coupons ?? []
}

/**
 * Create a percentage coupon on this event. The backend uppercases and
 * validates the code (A–Z, 0–9, hyphen, 3–20 chars) and enforces the one
 * global code namespace — a 409 names the event that already owns the code.
 */
export const createEventCoupon = async (eventId, payload) => {
  const { data } = await api.post(`/admin/events/${eventId}/coupons`, payload)
  return data.coupon
}

/** Partial edit; `{ isActive: false }` is the kill switch for a leaked code. */
export const updateCoupon = async (couponId, payload) => {
  const { data } = await api.patch(`/admin/coupons/${couponId}`, payload)
  return data.coupon
}

/**
 * Only a never-used coupon can be deleted — one referenced by any order
 * (even an expired hold) gets a 409: deactivate instead.
 */
export const deleteCoupon = async (couponId) => {
  const { data } = await api.delete(`/admin/coupons/${couponId}`)
  return data
}
