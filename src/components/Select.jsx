import { useId } from 'react'

const BASE =
  'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 focus:ring-1 focus:outline-none disabled:bg-gray-50 sm:text-sm'

/** `options` is [{ id, label }]. `placeholder` renders as a leading empty option. */
export default function Select({
  label,
  error,
  hint,
  options = [],
  placeholder,
  className = '',
  ...props
}) {
  const id = useId()
  const describedBy = error || hint ? `${id}-msg` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`${BASE} ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand focus:ring-brand'
        }`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {(error || hint) && (
        <p
          id={describedBy}
          className={`mt-1.5 text-xs ${error ? 'text-red-600' : 'text-gray-500'}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
}
