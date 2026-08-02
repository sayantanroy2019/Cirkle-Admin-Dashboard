import { useId } from 'react'

/** Label above the input, hint under it, error replacing the hint when set. */
export default function Field({ label, error, hint, className = '', ...props }) {
  const id = useId()
  const describedBy = error || hint ? `${id}-msg` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:bg-gray-50 sm:text-sm ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand focus:ring-brand'
        }`}
        {...props}
      />
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
