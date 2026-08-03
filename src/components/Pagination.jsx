import Button from './Button'

/**
 * "Showing X–Y of Z" plus Prev/Next, driven by the server's total.
 * Renders nothing when everything fits on one page.
 */
export default function Pagination({ page, pageCount, total, limit, rowCount, onPageChange }) {
  if (total === 0) return null

  const first = page * limit + 1
  const last = page * limit + rowCount

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/50 px-4 py-2.5">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{first}</span>–
        <span className="font-medium text-gray-700">{last}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
