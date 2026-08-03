import { useId } from 'react'

export default function Checkbox({ label, hint, className = '', ...props }) {
  const id = useId()

  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        id={id}
        type="checkbox"
        // accent-color is what actually tints a native checkbox — `text-*`
        // only works with the Tailwind forms plugin, which this project
        // doesn't use, so it would silently stay browser-default blue.
        className="mt-0.5 size-4 shrink-0 accent-brand disabled:opacity-50"
        {...props}
      />
      <label htmlFor={id} className="text-sm text-gray-700 select-none">
        {label}
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </label>
    </div>
  )
}
