import { useCallback, useEffect, useState } from 'react'
import { listCities, listEventCategories } from '../api/reference'
import { listOrganizers } from '../api/organizers'

/**
 * The three dropdowns the event form needs: organizers, categories, cities.
 *
 * Organizers come from the same endpoint the Organizers section uses — this is
 * the cross-system link, since assigning one here is what makes an event show
 * up in that organizer's dashboard.
 */
export default function useEventOptions() {
  const [organizers, setOrganizers] = useState([])
  const [categories, setCategories] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [orgs, cats, cts] = await Promise.all([
        listOrganizers(),
        listEventCategories(),
        listCities(),
      ])
      // Deactivated organizers stay selectable only if already assigned — the
      // dropdown itself offers active ones, so nobody assigns a new event to
      // an organizer who can't log in.
      setOrganizers(orgs)
      setCategories(cats)
      setCities(cts)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Organizer options for a form. Active organizers, plus the currently
   * assigned one even if it's since been deactivated — otherwise editing an
   * unrelated field would silently blank out the assignment.
   */
  const organizerOptions = (currentId) =>
    organizers
      .filter((o) => o.isActive || o.id === currentId)
      .map((o) => ({
        id: o.id,
        label: o.isActive ? o.displayName : `${o.displayName} (inactive)`,
      }))

  return { organizers, categories, cities, organizerOptions, loading, error, reload: load }
}
