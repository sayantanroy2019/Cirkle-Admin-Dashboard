import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_LIMIT } from '../api/oversight'
import { errorMessage } from '../lib/errors'

/**
 * Server-side pagination + filtering for the oversight tables.
 *
 * `fetcher` takes `{ ...filters, limit, offset }` and resolves to
 * `{ rows, total, limit, offset }`. Changing filters resets to page 0 —
 * otherwise you can land on page 4 of a 1-page result and see nothing.
 *
 * `mapFilters` lets a caller translate UI filter state into query params
 * (Orders uses it to turn calendar days into UTC instants).
 */
export default function usePaginatedList(fetcher, {
  initialFilters = {},
  limit = DEFAULT_LIMIT,
  mapFilters = (f) => f,
  errorLabel = "Couldn't load this list.",
} = {}) {
  const [filters, setFiltersState] = useState(initialFilters)
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Only the latest request may write state — filter changes fire fast.
  const requestId = useRef(0)

  const queryFilters = useMemo(() => mapFilters(filters), [filters, mapFilters])
  const queryKey = JSON.stringify(queryFilters)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const result = await fetcher({ ...JSON.parse(queryKey), limit, offset })
      if (id !== requestId.current) return
      setRows(result.rows)
      setTotal(result.total)
    } catch (err) {
      if (id !== requestId.current) return
      setError(errorMessage(err, errorLabel))
      setRows([])
      setTotal(0)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [fetcher, queryKey, limit, offset, errorLabel])

  useEffect(() => {
    load()
  }, [load])

  const setFilters = useCallback((update) => {
    setFiltersState((prev) => (typeof update === 'function' ? update(prev) : update))
    setOffset(0)
  }, [])

  const setFilter = useCallback((key, value) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
    setOffset(0)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(initialFilters)
    setOffset(0)
    // initialFilters is a literal from the caller; freezing it in a ref would
    // add noise for no benefit, so it is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const page = Math.floor(offset / limit)
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const hasFilters = Object.entries(filters).some(
    ([k, v]) => v !== '' && v !== null && v !== undefined && v !== initialFilters[k],
  )

  return {
    rows,
    total,
    limit,
    offset,
    page,
    pageCount,
    loading,
    error,
    filters,
    hasFilters,
    setFilter,
    setFilters,
    clearFilters,
    setPage: (p) => setOffset(Math.max(0, p) * limit),
    reload: load,
  }
}
