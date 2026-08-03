import Button from './Button'

/** Filter controls above a table, with a clear-all that appears once filtered. */
export default function FilterBar({ children, onClear, showClear, columns = 3 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[columns]

  return (
    <div className="mb-4">
      <div className={`grid gap-3 ${cols}`}>{children}</div>
      {showClear && (
        <div className="mt-3">
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
