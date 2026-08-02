import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listOrganizers } from '../api/organizers'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'

// The endpoint returns every organizer at once (it takes no limit/offset), so
// paging happens here. Controls only appear once there's more than one page.
const PAGE_SIZE = 25

const COLUMNS = ['Organizer', 'Email', 'Status', 'Events', 'Created']

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <tr key={i} className="border-t border-gray-100">
      {COLUMNS.map((c) => (
        <td key={c} className="px-4 py-3.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  ))
}

export default function OrganizersPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [organizers, setOrganizers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)

  // Set by the create/detail pages when they navigate back after a change.
  const [flash, setFlash] = useState(location.state?.flash ?? '')

  useEffect(() => {
    // Drop the flash from history so a refresh or back-nav doesn't replay it.
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setOrganizers(await listOrganizers())
    } catch (err) {
      setError(errorMessage(err, "Couldn't load organizers."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pageCount = Math.max(1, Math.ceil(organizers.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = organizers.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <PageHeader
        title="Organizers"
        description="Create and manage the organizers running events on Cirkle."
      >
        <Button to="/organizers/new">Create organizer</Button>
      </PageHeader>

      {flash && (
        <Alert className="mb-4" tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}

      {error ? (
        <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
          <p className="text-sm text-gray-600">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !loading && organizers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-900">No organizers yet.</p>
          <p className="mt-1 text-sm text-gray-500">Create one to get started.</p>
          <Button to="/organizers/new" className="mt-5">
            Create organizer
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {COLUMNS.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-4 py-2.5 text-xs font-semibold tracking-wide text-gray-500 uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : (
                  visible.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => navigate(`/organizers/${o.id}`)}
                      className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3.5">
                        {/* The link keeps the row keyboard-reachable; the row
                            click is a convenience on top of it. */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/organizers/${o.id}`)
                          }}
                          className="rounded-sm font-medium text-gray-900 hover:text-brand"
                        >
                          {o.displayName}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{o.email}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge isActive={o.isActive} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{o.eventCount ?? '—'}</td>
                      <td className="px-4 py-3.5 text-gray-600">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-4 py-2.5">
              <p className="text-xs text-gray-500">
                {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + visible.length} of{' '}
                {organizers.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Spinner className="size-3" />
          Loading organizers…
        </p>
      )}
    </>
  )
}
