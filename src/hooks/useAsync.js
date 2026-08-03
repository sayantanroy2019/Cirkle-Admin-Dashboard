import { useCallback, useEffect, useState } from 'react'

/**
 * One-shot fetch for things that load once and don't paginate — the event and
 * organizer lists behind the oversight filter dropdowns, the revenue summary.
 *
 * `fn` must be stable (module-level import or useCallback), or this re-runs
 * forever.
 */
export default function useAsync(fn, initialData = null) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fn())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [fn])

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run }
}
