/** Label/value rows for the read-only detail views. */
export default function DetailList({ items, className = '' }) {
  return (
    <dl className={`divide-y divide-gray-100 ${className}`}>
      {items
        .filter((i) => i)
        .map((item) => (
          <div key={item.label} className="flex justify-between gap-6 py-2.5 text-sm">
            <dt className="shrink-0 text-gray-500">{item.label}</dt>
            <dd
              className={`text-right ${
                item.strong ? 'font-semibold text-gray-900' : 'text-gray-900'
              }`}
            >
              {item.value ?? <span className="text-gray-400">—</span>}
            </dd>
          </div>
        ))}
    </dl>
  )
}
