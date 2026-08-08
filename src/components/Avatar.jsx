import { useEffect, useState } from 'react'

/**
 * An artist's photo, or the default avatar when there isn't one.
 *
 * The API returns `photoUrl: null` for a photo-less artist and expects each
 * frontend to supply its own placeholder. This mirrors the consumer app's
 * ArtistAvatar: the artist's initial over a soft tint, so the admin preview
 * shows what attendees will actually see rather than a different mark.
 *
 * The placeholder sits *under* the photo rather than instead of it, so an
 * expired presigned URL (they last ~1hr) falls back to the initial instead of
 * a broken-image glyph — same trick the consumer uses.
 */
export default function Avatar({ src, name, className = '' }) {
  const [photoOk, setPhotoOk] = useState(true)

  // A fresh URL (a refetch for new presigned links) deserves another attempt.
  useEffect(() => setPhotoOk(true), [src])

  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 ${className}`}
      role="img"
      aria-label={name ? `${name}${src ? '' : ' — no photo'}` : 'Artist photo'}
      title={src ? name : 'No photo — the default avatar is shown'}
    >
      <span className="absolute inset-0 flex items-center justify-center text-lg leading-none font-semibold text-gray-400 uppercase select-none">
        {initial}
      </span>
      {src && photoOk && (
        <img
          src={src}
          alt=""
          onError={() => setPhotoOk(false)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  )
}
