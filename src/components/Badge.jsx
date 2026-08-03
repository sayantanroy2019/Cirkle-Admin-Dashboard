const TONES = {
  gray: 'bg-gray-100 text-gray-600',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-brand-light text-brand',
}

const DOTS = {
  gray: 'bg-gray-400',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-brand',
}

/**
 * Status pill. Tones are deliberately muted — an admin table is mostly
 * statuses, and saturated colours turn it into a christmas tree.
 *
 * Tone lookups for each status vocabulary live in lib/status.js.
 */
export default function Badge({ tone = 'gray', dot = false, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${DOTS[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}
