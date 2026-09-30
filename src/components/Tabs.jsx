/** A plain tab strip. `tabs` is [{ id, label, count? }]. */
export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Sections">
        {tabs.map((t) => {
          const isActive = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    isActive ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
