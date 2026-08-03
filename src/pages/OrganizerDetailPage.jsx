import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getOrganizer, updateOrganizer } from '../api/organizers'
import { errorMessage, isConflict } from '../lib/errors'
import { INSTAGRAM_ERROR, handleForApi, isInvalidHandle, toBareHandle } from '../lib/instagram'
import { formatDate } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Field from '../components/Field'
import Alert from '../components/Alert'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

function Card({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function OrganizerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [organizer, setOrganizer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [flash, setFlash] = useState('')

  // Details form
  const [form, setForm] = useState({ displayName: '', email: '', instagram: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  // Password reset
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Status
  const [confirmingStatus, setConfirmingStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getOrganizer(id)
      setOrganizer(data)
      setForm({
        displayName: data.displayName,
        email: data.email,
        instagram: data.instagram ?? '',
      })
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load this organizer."))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  /**
   * The PATCH response omits `eventCount`, so merge rather than replace —
   * otherwise the event count silently disappears after any save.
   */
  const applyUpdate = (updated) => setOrganizer((prev) => ({ ...prev, ...updated }))

  const handleSaveDetails = async (event) => {
    event.preventDefault()
    if (savingDetails) return

    const errs = {}
    if (!form.displayName.trim()) errs.displayName = 'Display name can’t be empty.'
    if (!form.email.trim()) errs.email = 'Email can’t be empty.'
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (isInvalidHandle(form.instagram)) errs.instagram = INSTAGRAM_ERROR
    setFieldErrors(errs)
    setDetailsError('')
    if (Object.keys(errs).length > 0) return

    // Send only what actually changed — the backend 400s on an empty patch.
    const payload = {}
    if (form.displayName.trim() !== organizer.displayName) {
      payload.displayName = form.displayName.trim()
    }
    if (form.email.trim().toLowerCase() !== organizer.email) {
      payload.email = form.email.trim().toLowerCase()
    }
    // Compare normalised, so retyping the same handle with an @ isn't a change.
    // handleForApi returns null for empty, which is how the API clears it.
    if (handleForApi(form.instagram) !== (organizer.instagram ?? null)) {
      payload.instagram = handleForApi(form.instagram)
    }
    if (Object.keys(payload).length === 0) {
      setFlash('No changes to save.')
      return
    }

    setSavingDetails(true)
    try {
      applyUpdate(await updateOrganizer(id, payload))
      setFlash('Details updated.')
    } catch (err) {
      if (isConflict(err)) {
        setFieldErrors({ email: 'An organizer with this email already exists.' })
      } else {
        setDetailsError(errorMessage(err, "Couldn't save those changes."))
      }
    } finally {
      setSavingDetails(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (savingPassword) return

    if (password.length < MIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    setPasswordError('')
    setSavingPassword(true)

    try {
      applyUpdate(await updateOrganizer(id, { password }))
      // Cleared immediately — never logged, never in the URL, never kept.
      setPassword('')
      setFlash('Password reset. Share the new password with the organizer.')
    } catch (err) {
      setPasswordError(errorMessage(err, "Couldn't reset the password."))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleToggleStatus = async () => {
    if (savingStatus) return
    const next = !organizer.isActive

    setSavingStatus(true)
    setStatusError('')
    try {
      applyUpdate(await updateOrganizer(id, { isActive: next }))
      setConfirmingStatus(false)
      setFlash(
        next
          ? 'Organizer reactivated. They can sign in again.'
          : 'Organizer deactivated. They can no longer sign in.',
      )
    } catch (err) {
      setStatusError(errorMessage(err, "Couldn't change the account status."))
    } finally {
      setSavingStatus(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading organizer…
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{loadError}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
          <Button variant="secondary" to="/organizers">
            Back to organizers
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title={organizer.displayName}>
        <Button
          variant="secondary"
          onClick={() =>
            navigate('/organizers', { state: { flash: flash || undefined } })
          }
        >
          Back to organizers
        </Button>
      </PageHeader>

      <Link to="/organizers" className="text-sm text-gray-500 hover:text-gray-900">
        ← Organizers
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <StatusBadge isActive={organizer.isActive} />
        <span>
          {organizer.eventCount ?? 0} {organizer.eventCount === 1 ? 'event' : 'events'}
        </span>
        <span>Created {formatDate(organizer.createdAt)}</span>
      </div>

      {flash && (
        <Alert className="mt-4" tone="success">
          {flash}
        </Alert>
      )}

      <div className="mt-6 max-w-lg space-y-5">
        <Card title="Details">
          <form onSubmit={handleSaveDetails} className="space-y-4" noValidate>
            {detailsError && <Alert tone="error">{detailsError}</Alert>}

            <Field
              label="Display name"
              value={form.displayName}
              onChange={(e) => {
                setForm((f) => ({ ...f, displayName: e.target.value }))
                setFieldErrors((errs) => ({ ...errs, displayName: '' }))
                setFlash('')
              }}
              error={fieldErrors.displayName}
              disabled={savingDetails}
              autoComplete="off"
            />

            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }))
                setFieldErrors((errs) => ({ ...errs, email: '' }))
                setFlash('')
              }}
              error={fieldErrors.email}
              hint="Changing this changes the email they sign in with."
              disabled={savingDetails}
            />

            <Field
              label="Instagram"
              value={form.instagram}
              onChange={(e) => {
                setForm((f) => ({ ...f, instagram: e.target.value }))
                setFieldErrors((errs) => ({ ...errs, instagram: '' }))
                setFlash('')
              }}
              onBlur={(e) => setForm((f) => ({ ...f, instagram: toBareHandle(e.target.value) }))}
              error={fieldErrors.instagram}
              hint="Optional. Shown on their event pages. Clear it to remove the link."
              disabled={savingDetails}
              placeholder="kittysu"
              autoComplete="off"
              autoCapitalize="none"
            />

            <Button type="submit" loading={savingDetails}>
              {savingDetails ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Card>

        <Card
          title="Reset password"
          description="Sets a new password for this organizer. You'll need to pass it to them yourself — existing passwords can't be viewed."
        >
          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError('')
                setFlash('')
              }}
              error={passwordError}
              hint={`At least ${MIN_PASSWORD} characters.`}
              disabled={savingPassword}
              placeholder="••••••••"
            />
            <Button type="submit" variant="secondary" loading={savingPassword} disabled={!password}>
              {savingPassword ? 'Resetting…' : 'Reset password'}
            </Button>
          </form>
        </Card>

        <Card
          title="Account status"
          description={
            organizer.isActive
              ? 'Deactivating will immediately prevent this organizer from logging in. Their events and data are kept, and you can reactivate them at any time.'
              : 'This organizer can’t log in. Reactivating restores their access immediately.'
          }
        >
          {statusError && <Alert tone="error" className="mb-4">{statusError}</Alert>}

          {confirmingStatus ? (
            <div className="space-y-3">
              <Alert tone="warning">
                Deactivate <strong>{organizer.displayName}</strong>? They'll be
                signed out of the organizer dashboard and won't be able to log
                back in until reactivated.
              </Alert>
              <div className="flex gap-3">
                <Button variant="caution" loading={savingStatus} onClick={handleToggleStatus}>
                  {savingStatus ? 'Deactivating…' : 'Yes, deactivate'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={savingStatus}
                  onClick={() => setConfirmingStatus(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : organizer.isActive ? (
            <Button variant="caution" onClick={() => setConfirmingStatus(true)}>
              Deactivate organizer
            </Button>
          ) : (
            <Button loading={savingStatus} onClick={handleToggleStatus}>
              {savingStatus ? 'Reactivating…' : 'Reactivate organizer'}
            </Button>
          )}
        </Card>
      </div>
    </>
  )
}
