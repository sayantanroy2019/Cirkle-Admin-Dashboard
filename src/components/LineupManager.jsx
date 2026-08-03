import { useMemo, useRef, useState } from 'react'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_ARTISTS,
  setArtistPhoto,
  setLineup,
  uploadArtistPhoto,
} from '../api/artists'
import { errorMessage } from '../lib/errors'
import { INSTAGRAM_ERROR, handleForApi, isInvalidHandle, toBareHandle } from '../lib/instagram'
import Button from './Button'
import Alert from './Alert'
import Avatar from './Avatar'

/**
 * The event lineup — up to 10 artists, position 0 is the headliner.
 *
 * Two different save models sit side by side here, because the API works that
 * way:
 *
 *  - **Names, handles and order are staged** and committed together by
 *    "Save lineup" (a single PUT).
 *  - **Photos save immediately**, because they're attached per artist and keyed
 *    to the artist id — so an artist has to exist server-side before it can
 *    have a photo. A row that hasn't been saved yet has its photo control
 *    disabled and says why.
 *
 * The PUT is an upsert: every saved artist's `id` is sent back so it's updated
 * in place and keeps its photo. Dropping the id would recreate the row and
 * silently orphan the photo.
 */

let tempCounter = 0
const newRow = () => ({
  key: `new-${++tempCounter}`,
  id: null,
  name: '',
  instagram: '',
  photoUrl: null,
})

const fromApi = (artists) =>
  [...artists]
    .sort((a, b) => a.position - b.position)
    .map((a) => ({
      key: a.id,
      id: a.id,
      name: a.name ?? '',
      instagram: a.instagram ?? '',
      photoUrl: a.photoUrl ?? null,
    }))

export default function LineupManager({ eventId, artists, onChange }) {
  const initial = useMemo(() => fromApi(artists ?? []), [artists])

  const [rows, setRows] = useState(initial)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busyPhotoKey, setBusyPhotoKey] = useState(null)
  const fileInputs = useRef({})

  const dirty =
    rows.length !== initial.length ||
    rows.some((r, i) => {
      const was = initial[i]
      return (
        !was ||
        r.id !== was.id ||
        r.name !== was.name ||
        toBareHandle(r.instagram) !== toBareHandle(was.instagram)
      )
    })

  const update = (index, patch) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setSaved(false)
  }

  const move = (from, to) => {
    if (to < 0 || to >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  const remove = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setErrors({})
    setSaved(false)
  }

  const validate = () => {
    const errs = {}
    rows.forEach((r, i) => {
      if (!r.name.trim()) errs[`name-${i}`] = 'Enter a name.'
      if (isInvalidHandle(r.instagram)) errs[`instagram-${i}`] = INSTAGRAM_ERROR
    })
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    setErrors(errs)
    setError('')
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const payload = rows.map((r, i) => ({
        // Sending the id back is what keeps this an in-place update — and what
        // keeps the artist's photo attached.
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(),
        instagram: handleForApi(r.instagram),
        position: i,
      }))
      const next = await setLineup(eventId, payload)
      setRows(fromApi(next))
      onChange(next)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the lineup."))
    } finally {
      setSaving(false)
    }
  }

  const handlePickPhoto = async (index, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const row = rows[index]
    if (!row.id) return // guarded in the UI too

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.')
      return
    }

    setError('')
    setBusyPhotoKey(row.key)
    try {
      const photoUrl = await uploadArtistPhoto(eventId, row.id, file)
      update(index, { photoUrl })
      onChange(
        rows.map((r, i) =>
          i === index ? { ...r, photoUrl, position: i } : { ...r, position: i },
        ),
      )
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload that photo."))
    } finally {
      setBusyPhotoKey(null)
    }
  }

  const handleClearPhoto = async (index) => {
    const row = rows[index]
    if (!row.id) return
    setBusyPhotoKey(row.key)
    setError('')
    try {
      await setArtistPhoto(eventId, row.id, null)
      update(index, { photoUrl: null })
    } catch (err) {
      setError(errorMessage(err, "Couldn't remove that photo."))
    } finally {
      setBusyPhotoKey(null)
    }
  }

  const atCap = rows.length >= MAX_ARTISTS
  const hasUnsavedRows = rows.some((r) => !r.id)

  return (
    <div>
      {error && (
        <Alert tone="error" className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-4" onDismiss={() => setSaved(false)}>
          Lineup saved.
        </Alert>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-500">
          No artists yet. Add the headliner first.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, i) => (
            <li
              key={row.key}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-start"
            >
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className="w-14 shrink-0 text-xs font-medium text-gray-500"
                  title={i === 0 ? 'Position 0 — the headliner' : `Position ${i}`}
                >
                  {i === 0 ? 'Headliner' : `#${i + 1}`}
                </span>
                <Avatar
                  src={row.photoUrl}
                  name={row.name}
                  className="size-14 shrink-0 rounded-full"
                />
              </div>

              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Name
                    <input
                      value={row.name}
                      onChange={(e) => {
                        update(i, { name: e.target.value })
                        setErrors((p) => ({ ...p, [`name-${i}`]: '' }))
                      }}
                      disabled={saving}
                      placeholder="Arijit Singh"
                      autoComplete="off"
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:bg-gray-50 ${
                        errors[`name-${i}`]
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-brand focus:ring-brand'
                      }`}
                    />
                  </label>
                  {errors[`name-${i}`] && (
                    <p className="mt-1 text-xs text-red-600">{errors[`name-${i}`]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Instagram
                    <input
                      value={row.instagram}
                      onChange={(e) => {
                        update(i, { instagram: e.target.value })
                        setErrors((p) => ({ ...p, [`instagram-${i}`]: '' }))
                      }}
                      // Normalise once they're done typing, so a pasted profile
                      // link visibly becomes the bare handle that gets stored.
                      onBlur={(e) => update(i, { instagram: toBareHandle(e.target.value) })}
                      disabled={saving}
                      placeholder="arijitsingh"
                      autoComplete="off"
                      autoCapitalize="none"
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:bg-gray-50 ${
                        errors[`instagram-${i}`]
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:border-brand focus:ring-brand'
                      }`}
                    />
                  </label>
                  {errors[`instagram-${i}`] ? (
                    <p className="mt-1 text-xs text-red-600">{errors[`instagram-${i}`]}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">Optional. @ and links are fine.</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-col sm:items-stretch">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0 || saving}
                    aria-label={`Move ${row.name || `artist ${i + 1}`} up`}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === rows.length - 1 || saving}
                    aria-label={`Move ${row.name || `artist ${i + 1}`} down`}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>

                <input
                  ref={(el) => {
                    fileInputs.current[row.key] = el
                  }}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={(e) => handlePickPhoto(i, e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputs.current[row.key]?.click()}
                  disabled={!row.id || busyPhotoKey === row.key || saving}
                  title={
                    row.id
                      ? undefined
                      : 'Save the lineup first — a photo attaches to a saved artist'
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                >
                  {busyPhotoKey === row.key
                    ? 'Uploading…'
                    : row.photoUrl
                      ? 'Change photo'
                      : 'Add photo'}
                </button>
                {row.photoUrl && (
                  <button
                    type="button"
                    onClick={() => handleClearPhoto(i)}
                    disabled={busyPhotoKey === row.key || saving}
                    className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:text-gray-900 disabled:opacity-40"
                  >
                    Remove photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={saving}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:text-red-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => setRows((p) => [...p, newRow()])}
          disabled={atCap || saving}
          title={atCap ? `A lineup holds at most ${MAX_ARTISTS} artists` : undefined}
        >
          Add artist
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          {saving ? 'Saving…' : 'Save lineup'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => { setRows(initial); setErrors({}); setError('') }} disabled={saving}>
            Discard changes
          </Button>
        )}
        <p className="text-xs text-gray-500">
          {rows.length}/{MAX_ARTISTS}
          {atCap && ' · at the limit'}
        </p>
      </div>

      {hasUnsavedRows && (
        <p className="mt-2 text-xs text-gray-500">
          Save the lineup to enable photo upload for newly added artists.
        </p>
      )}
    </div>
  )
}
