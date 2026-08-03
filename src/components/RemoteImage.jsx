import { useEffect, useState } from 'react'

/**
 * An <img> for presigned S3 URLs, with a graceful fallback.
 *
 * These URLs expire in about an hour, and a record can outlive its object
 * (some seeded profile photos point at keys that were never uploaded). Either
 * way the browser's broken-image icon is the wrong answer in an admin tool —
 * it reads as "the portal is broken" rather than "this image is unavailable".
 */
export default function RemoteImage({ src, alt, className = '', fallbackLabel = 'Unavailable' }) {
  const [failed, setFailed] = useState(false)

  // A new src (a refetch for fresh URLs) deserves another attempt.
  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 text-center text-[10px] text-gray-400 ${className}`}
        title={src ? 'This image could not be loaded' : 'No image'}
      >
        {fallbackLabel}
      </div>
    )
  }

  return (
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  )
}
