/**
 * Cirkle wordmark. Matches the organizer dashboard's mark — a plain type-set
 * wordmark with a single accent dot. Swap the span for an <img> if a supplied
 * SVG logo lands later.
 */
export default function Logo({ className = '' }) {
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 font-semibold tracking-tight text-gray-900 ${className}`}
    >
      cirkle
      <span className="size-1.5 translate-y-px rounded-full bg-brand" aria-hidden="true" />
    </span>
  )
}
