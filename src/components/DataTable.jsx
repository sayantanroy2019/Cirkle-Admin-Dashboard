import Button from './Button'
import Pagination from './Pagination'
import Spinner from './Spinner'

/**
 * The shared oversight table: header, skeleton rows while loading, empty and
 * error states, and server-driven pagination underneath.
 *
 * `columns` is [{ key, header, render(row), className }]. `render` returns the
 * cell content; `key` is only an identity.
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  onRowClick,
  emptyTitle = 'Nothing here yet.',
  emptyHint,
  emptyAction,
  loadingLabel = 'Loading…',
  pagination,
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{error}</p>
        {onRetry && (
          <Button variant="secondary" className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-14 text-center">
        <p className="text-sm font-medium text-gray-900">{emptyTitle}</p>
        {emptyHint && <p className="mt-1 text-sm text-gray-500">{emptyHint}</p>}
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {columns.map((c) => (
                        <td key={c.key} className="px-4 py-3.5">
                          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr
                      key={row.id ?? row.eventId}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={`border-t border-gray-100 transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                      }`}
                    >
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-4 py-3.5 whitespace-nowrap text-gray-600 ${c.className ?? ''}`}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && pagination && <Pagination {...pagination} />}
      </div>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Spinner className="size-3" />
          {loadingLabel}
        </p>
      )}
    </>
  )
}
