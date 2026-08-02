import axios from 'axios'
import api from './client'

/**
 * Event endpoints.
 *
 * Verified against Swagger and the live API on 2026-08-02. Responses are
 * enveloped (`{ events }` / `{ event }`), unwrapped here and nowhere else.
 *
 * An AdminEvent reads:
 *   { id, name, categoryId, cityId, startsAt, endsAt, price, capacity,
 *     targetGroupSize, eventType, venueName, venueAddress, description,
 *     organizerId, createdAt, updatedAt, bannerUrl }
 * plus `organizerName` on the list, and `gallery` + `organizer` on detail.
 *
 * `price` is in PAISE. There is no ticket-sold count on these endpoints, and
 * no DELETE — events cannot be removed.
 */

/** Filters: { organizerId, cityId, status: 'upcoming' | 'past' }. Server-side. */
export const listEvents = async (filters = {}) => {
  const params = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v) params[k] = v
  }
  const { data } = await api.get('/admin/events', { params })
  return data.events ?? []
}

export const getEvent = async (id) => {
  const { data } = await api.get(`/admin/events/${id}`)
  return data.event
}

export const createEvent = async (payload) => {
  const { data } = await api.post('/admin/events', payload)
  return data.event
}

/**
 * Partial update. 400 on an empty body, so callers send only changed fields.
 *
 * The response is the base projection — it carries `bannerUrl` but NOT
 * `gallery` or `organizer`, both of which detail returns. Merge this into the
 * event you already hold; replacing wholesale drops the gallery and the
 * organizer block from the screen.
 */
export const updateEvent = async (id, payload) => {
  const { data } = await api.patch(`/admin/events/${id}`, payload)
  return data.event
}

/* ── Images ─────────────────────────────────────────────────────────────
   Three-step handshake per image:
     1. POST .../image-url  → { uploadUrl, key }
     2. PUT the bytes straight to uploadUrl (S3, no auth, 5-minute expiry)
     3. attach the key via PATCH .../banner or PUT .../gallery
   The backend HeadObjects every key before saving, so step 3 fails if step 2
   didn't really land.                                                     */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_GALLERY_PHOTOS = 5

/** `kind` is 'banner' | 'gallery'; `contentType` must be one of the three above. */
export const getImageUploadUrl = async (eventId, { contentType, kind }) => {
  const { data } = await api.post(`/admin/events/${eventId}/image-url`, {
    contentType,
    kind,
  })
  return data // { uploadUrl, key }
}

/**
 * Step 2 — deliberately NOT the shared `api` instance.
 *
 * This goes to S3, not our backend: sending the Authorization or ngrok headers
 * would break the presigned signature, and the baseURL would rewrite the URL.
 * Content-Type has to match what step 1 was signed for.
 */
export const uploadToS3 = (uploadUrl, file, onProgress) =>
  axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    transformRequest: [(d) => d], // keep the Blob intact
    onUploadProgress: onProgress
      ? (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
      : undefined,
  })

/** Attach an uploaded key as the banner. Returns the fresh presigned view URL. */
export const setBanner = async (eventId, s3Key) => {
  const { data } = await api.patch(`/admin/events/${eventId}/banner`, { s3Key })
  return data.bannerUrl
}

/**
 * Replace the whole gallery — this is a full replace, not an append, so send
 * every photo you want to keep. Max 5, positions 0-4, no duplicates.
 *
 * All-or-nothing: if any key isn't in S3 the request is rejected with 400 and
 * the existing gallery is left untouched.
 */
export const setGallery = async (eventId, photos) => {
  const { data } = await api.put(`/admin/events/${eventId}/gallery`, { photos })
  return data.gallery ?? []
}

/** Convenience: the full per-image handshake, returning the S3 key. */
export const uploadEventImage = async (eventId, file, kind, onProgress) => {
  const { uploadUrl, key } = await getImageUploadUrl(eventId, {
    contentType: file.type,
    kind,
  })
  await uploadToS3(uploadUrl, file, onProgress)
  return key
}
