import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ADMIN_ROLES, createAdmin, MIN_ADMIN_PASSWORD, ROLE_LABELS } from '../api/admins'
import { errorMessage, isConflict } from '../lib/errors'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Field from '../components/Field'
import Select from '../components/Select'
import Alert from '../components/Alert'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'business_development',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((errs) => ({ ...errs, [key]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.displayName.trim()) errs.displayName = 'Enter a name.'
    if (!form.email.trim()) errs.email = 'Enter an email address.'
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (!form.password) errs.password = 'Set an initial password.'
    else if (form.password.length < MIN_ADMIN_PASSWORD)
      errs.password = `Use at least ${MIN_ADMIN_PASSWORD} characters.`
    if (!form.role) errs.role = 'Choose a role.'
    return errs
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const errs = validate()
    setFieldErrors(errs)
    setFormError('')
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    const email = form.email.trim().toLowerCase()
    const role = form.role

    try {
      await createAdmin({
        email,
        password: form.password,
        displayName: form.displayName.trim(),
        role,
      })

      // Clear the password the moment it's no longer needed — it is never
      // logged, never put in a URL, and never echoed back in the confirmation.
      setForm({ displayName: '', email: '', password: '', role: 'business_development' })

      navigate('/admins', {
        replace: true,
        state: {
          flash: `${ROLE_LABELS[role]} admin created — ${email}. Share the password you set with them; it can't be viewed again, and there's currently no way to reset it from the portal.`,
        },
      })
    } catch (err) {
      if (isConflict(err)) {
        setFieldErrors({ email: 'An admin with this email already exists.' })
      } else {
        setFormError(errorMessage(err, "Couldn't create the admin account."))
      }
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Create admin"
        description="They'll sign in to this portal with these credentials."
      />

      <div className="max-w-lg">
        <Link to="/admins" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to admins
        </Link>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label="Name"
            value={form.displayName}
            onChange={set('displayName')}
            error={fieldErrors.displayName}
            disabled={submitting}
            placeholder="Priya Sharma"
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
            onChange={set('email')}
            error={fieldErrors.email}
            hint="Their login for this portal. It can't be changed later."
            disabled={submitting}
            placeholder="priya@cirkle.live"
          />

          <Field
            label="Initial password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={fieldErrors.password}
            hint={`At least ${MIN_ADMIN_PASSWORD} characters. Pass it to them yourself — the portal can't show or reset it afterwards.`}
            disabled={submitting}
            placeholder="••••••••"
          />

          <Select
            label="Role"
            value={form.role}
            onChange={set('role')}
            error={fieldErrors.role}
            options={ADMIN_ROLES}
            hint="Administrative admins can manage admin accounts. Business development admins can do everything else."
            disabled={submitting}
          />

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting}>
              {submitting ? 'Creating…' : 'Create admin'}
            </Button>
            <Button variant="secondary" to="/admins">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
