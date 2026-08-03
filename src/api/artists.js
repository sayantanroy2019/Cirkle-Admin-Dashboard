import axios from 'axios'
import api from './client'
import { ALLOWED_IMAGE_TYPES } from './events'

/**
 * An event's lineup.
 *
 * Verified against Swagger and the live API on 2026-08-03. An artist reads:
 *   { id, name, instagram, photoUrl, position }
 * `instagram` is the bare handle (normalized server-side), `photoUrl` is a
 * presigned GET URL or null, and `position` 0 is the headliner.
 *
 * The important subtlety — `PUT .../artists` is an **upsert by id**, not the
 * delete-and-reinsert the gallery uses:
 *
 *   - include an artist's `id` → updated in place, photo preserved
 *   - omit `id`                → a new artist row is created
 *   - any existing id absent from the payload → that artist is deleted
 *
 * So the ids from GET must be sent back. Verified: re-sending an artist without
 * its id creates a fresh row whose `photoUrl` is null — the photo is lost even
 * though the name and position look identical.
 *
 * Photos are attached per artist and keyed to the artist id, which is why the
 * artist must exist before a photo can be uploaded for it.
 */

export const MAX_ARTISTS = 10

export const listArtists = async (eventId) => {
  const { data } = await api.get(`/admin/events/${eventId}/artists`)
  return data.artists ?? []
}

/**
 * Replace the lineup. `artists` is [{ id?, name, instagram, position }].
 * 400 on more than 10, a missing name, duplicate/invalid positions, an
 * unparseable Instagram handle, or an id belonging to another event.
 */
export const setLineup = async (eventId, artists) => {
  const { data } = await api.put(`/admin/events/${eventId}/artists`, { artists })
  return data.artists ?? []
}

/** Step 1 of the per-artist photo handshake. The artist must already exist. */
export const getArtistImageUploadUrl = async (eventId, artistId, contentType) => {
  const { data } = await api.post(
    `/admin/events/${eventId}/artists/${artistId}/image-url`,
    { contentType },
  )
  return data // { uploadUrl, key }
}

/**
 * Step 2 — straight to S3, deliberately not through the shared client (its
 * auth/ngrok headers and baseURL would break the presigned request).
 */
const uploadToS3 = (uploadUrl, file, onProgress) =>
  axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type },
    transformRequest: [(d) => d],
    onUploadProgress: onProgress
      ? (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
      : undefined,
  })

/**
 * Step 3 — attach the key, or pass null to clear the photo (the artist then
 * falls back to the default avatar). The backend verifies the object exists in
 * S3 and that the key is namespaced to this artist.
 */
export const setArtistPhoto = async (eventId, artistId, s3Key) => {
  const { data } = await api.patch(
    `/admin/events/${eventId}/artists/${artistId}/photo`,
    { s3Key },
  )
  return data.photoUrl ?? null
}

/** The whole handshake for one artist. Returns the fresh presigned photo URL. */
export const uploadArtistPhoto = async (eventId, artistId, file, onProgress) => {
  const { uploadUrl, key } = await getArtistImageUploadUrl(eventId, artistId, file.type)
  await uploadToS3(uploadUrl, file, onProgress)
  return setArtistPhoto(eventId, artistId, key)
}

export { ALLOWED_IMAGE_TYPES }
