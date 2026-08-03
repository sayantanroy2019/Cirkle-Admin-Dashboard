import RemoteImage from './RemoteImage'

/**
 * An artist's photo, or the default avatar when there isn't one.
 *
 * The API returns `photoUrl: null` for a photo-less artist and expects the
 * frontend to supply its own placeholder, so the admin preview shows the same
 * fallback consumers will see. If the consumer app ships a different default
 * mark, this is the one place to match it.
 */
export default function Avatar({ src, name, className = '' }) {
  if (src) {
    return (
      <RemoteImage
        src={src}
        alt={name ? `${name}'s photo` : 'Artist photo'}
        className={`object-cover ${className}`}
        fallbackLabel="No photo"
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      role="img"
      aria-label={name ? `${name} — no photo` : 'No photo'}
      title="No photo — the default avatar is shown"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-1/2" aria-hidden="true">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
      </svg>
    </div>
  )
}
