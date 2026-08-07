import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ADMIN_ROLES, MIN_ADMIN_PASSWORD, listAdmins, ROLE_LABELS, updateAdmin } from '../api/admins'
import { useAuthStore } from '../store/authStore'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { blockDeactivation, blockRoleChange, isSelf, warnRoleChange } from '../lib/adminGuards'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Field from '../components/Field'
import Select from '../components/Select'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'

function Card({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AdminEditPage() {
  const { id } = useParams()
  const currentAdmin = useAuthStore((s) => s.admin)
  const setSession = useAuthStore((s) => s.login)
  const token = useAuthStore((s) => s.token)

  // `GET /admin/admins/:id` exists now, but the lockout guards need to count
  // active administrative admins, so the list is fetched anyway and the row
  // comes from it — one request rather than two.
  const [admins, setAdmins] = useState([])
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [flash, setFlash] = useState('')

  const [form, setForm] = useState({ displayName: '', role: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Password reset — same shape as the organizer reset on OrganizerDetailPage.
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [confirmingStatus, setConfirmingStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const all = await listAdmins()
      setAdmins(all)
      const found = all.find((a) => a.id === id)
      if (!found) {
        setLoadError('That admin account no longer exists.')
        return
      }
      setAdmin(found)
      setForm({ displayName: found.displayName, role: found.role })
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load this admin account."))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  /** Keep the sidebar honest when an admin renames or re-roles themselves. */
  const syncSessionIfSelf = (updated) => {
    if (isSelf(updated, currentAdmin)) {
      setSession(token, {
        ...currentAdmin,
        displayName: updated.displayName,
        role: updated.role,
      })
    }
  }

  const applyUpdate = (updated) => {
    setAdmin(updated)
    setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    syncSessionIfSelf(updated)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (saving) return

    const errs = {}
    if (!form.displayName.trim()) errs.displayName = 'Name can’t be empty.'
    setFieldErrors(errs)
    setSaveError('')
    if (Object.keys(errs).length > 0) return

    const roleBlock = blockRoleChange(admin, form.role, currentAdmin, admins)
    if (roleBlock) {
      setSaveError(roleBlock)
      return
    }

    // Only what changed — an empty PATCH body is a 400.
    const payload = {}
    if (form.displayName.trim() !== admin.displayName) payload.displayName = form.displayName.trim()
    if (form.role !== admin.role) payload.role = form.role

    if (Object.keys(payload).length === 0) {
      setFlash('No changes to save.')
      return
    }

    setSaving(true)
    try {
      applyUpdate(await updateAdmin(id, payload))
      setFlash('Admin updated.')
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save those changes."))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (savingPassword) return

    if (password.length < MIN_ADMIN_PASSWORD) {
      setPasswordError(`Use at least ${MIN_ADMIN_PASSWORD} characters.`)
      return
    }
    setPasswordError('')
    setSavingPassword(true)

    try {
      // A body containing only `password` is valid — it no longer 400s with
      // "No fields to update". A reset changes no counts, so the lockout rules
      // never block it; resetting your own password is always allowed.
      applyUpdate(await updateAdmin(id, { password }))
      // Cleared immediately — never logged, never in the URL, never echoed
      // back in the confirmation.
      setPassword('')
      setFlash('Password reset. Share the new password with the admin.')
    } catch (err) {
      setPasswordError(errorMessage(err, "Couldn't reset the password."))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleToggleStatus = async () => {
    if (savingStatus) return
    const next = !admin.isActive

    setSavingStatus(true)
    setStatusError('')
    try {
      applyUpdate(await updateAdmin(id, { isActive: next }))
      setConfirmingStatus(false)
      setFlash(next ? 'Admin reactivated.' : 'Admin deactivated. They can no longer sign in.')
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
        Loading admin…
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
          <Button variant="secondary" to="/admins">
            Back to admins
          </Button>
        </div>
      </div>
    )
  }

  const self = isSelf(admin, currentAdmin)
  const deactivationBlock = blockDeactivation(admin, currentAdmin, admins)
  const roleBlock = blockRoleChange(admin, form.role, currentAdmin, admins)
  const roleWarning = warnRoleChange(admin, form.role, currentAdmin)

  return (
    <>
      <PageHeader title={admin.displayName}>
        <Button variant="secondary" to="/admins">
          Back to admins
        </Button>
      </PageHeader>

      <Link to="/admins" className="text-sm text-gray-500 hover:text-gray-900">
        ← Admins
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <Badge tone={admin.role === 'administrative' ? 'purple' : 'gray'}>
          {ROLE_LABELS[admin.role] ?? admin.role}
        </Badge>
        <Badge tone={admin.isActive ? 'green' : 'gray'} dot>
          {admin.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <span>{admin.email}</span>
        <span>Created {formatDate(admin.createdAt)}</span>
        {self && <span className="text-gray-400">This is your account</span>}
      </div>

      {flash && (
        <Alert className="mt-4" tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}

      <div className="mt-6 max-w-lg space-y-5">
        <Card title="Details">
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            {saveError && <Alert tone="error">{saveError}</Alert>}

            <Field
              label="Name"
              value={form.displayName}
              onChange={(e) => {
                setForm((f) => ({ ...f, displayName: e.target.value }))
                setFieldErrors((errs) => ({ ...errs, displayName: '' }))
                setFlash('')
              }}
              error={fieldErrors.displayName}
              disabled={saving}
              autoComplete="off"
            />

            <Field
              label="Email"
              value={admin.email}
              disabled
              readOnly
              hint="Email can't be changed after an account is created."
            />

            <Select
              label="Role"
              value={form.role}
              onChange={(e) => {
                setForm((f) => ({ ...f, role: e.target.value }))
                setSaveError('')
                setFlash('')
              }}
              options={ADMIN_ROLES}
              disabled={saving}
              hint="Administrative admins can manage admin accounts. Business development admins can do everything else."
            />

            {roleBlock && <Alert tone="error">{roleBlock}</Alert>}
            {!roleBlock && roleWarning && <Alert tone="warning">{roleWarning}</Alert>}

            <Button type="submit" loading={saving} disabled={Boolean(roleBlock)}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Card>

        <Card
          title="Reset password"
          description="Sets a new password for this admin. You'll need to pass it to them yourself — existing passwords can't be viewed."
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
              hint={`At least ${MIN_ADMIN_PASSWORD} characters.`}
              disabled={savingPassword}
              placeholder="••••••••"
            />
            <Button
              type="submit"
              variant="secondary"
              loading={savingPassword}
              disabled={!password}
            >
              {savingPassword ? 'Resetting…' : 'Reset password'}
            </Button>
          </form>
        </Card>

        <Card
          title="Account status"
          description={
            admin.isActive
              ? 'Deactivating takes effect immediately — their current session stops working, not just their next sign-in. Reversible at any time.'
              : 'This admin can’t sign in. Reactivating restores their access immediately.'
          }
        >
          {statusError && (
            <Alert tone="error" className="mb-4">
              {statusError}
            </Alert>
          )}

          {deactivationBlock ? (
            <Alert tone="warning">{deactivationBlock}</Alert>
          ) : confirmingStatus ? (
            <div className="space-y-3">
              <Alert tone="warning">
                Deactivate <strong>{admin.displayName}</strong>? They'll be signed
                out immediately and won't be able to sign back in until reactivated.
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
          ) : admin.isActive ? (
            <Button variant="caution" onClick={() => setConfirmingStatus(true)}>
              Deactivate admin
            </Button>
          ) : (
            <Button loading={savingStatus} onClick={handleToggleStatus}>
              {savingStatus ? 'Reactivating…' : 'Reactivate admin'}
            </Button>
          )}
        </Card>
      </div>
    </>
  )
}
