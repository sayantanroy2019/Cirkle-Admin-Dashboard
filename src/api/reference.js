import api from './client'

/**
 * Reference data for the event form's dropdowns.
 *
 * Public endpoints (no auth needed), but they live on the same backend so the
 * shared client is still the right way to reach them.
 *
 * Note the two shapes differ — cities carry `name`, categories carry `label`.
 * Both are normalised to { id, label } here so the form only knows one shape.
 */

export const listCities = async () => {
  const { data } = await api.get('/reference/cities')
  return (data.cities ?? []).map((c) => ({ id: c.id, label: c.name }))
}

export const listEventCategories = async () => {
  const { data } = await api.get('/reference/event-categories')
  return (data.eventCategories ?? []).map((c) => ({ id: c.id, label: c.label }))
}
