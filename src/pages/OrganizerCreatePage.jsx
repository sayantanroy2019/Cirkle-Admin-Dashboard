import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createOrganizer } from '../api/organizers'
import { errorMessage, isConflict } from '../lib/errors'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Field from '../components/Field'
import Alert from '../components/Alert'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8 // matches the backend's MIN_PASSWORD_LENGTH

export default function OrganizerCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((errs) => ({ ...errs, [key]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.displayName.trim()) errs.displayName = 'Enter the organizer’s business name.'
    if (!form.email.trim()) errs.email = 'Enter an email address.'
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (!form.password) errs.password = 'Set an initial password.'
    else if (form.password.length < MIN_PASSWORD)
      errs.password = `Use at least ${MIN_PASSWORD} characters.`
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

    try {
      await createOrganizer({
        email,
        password: form.password,
        displayName: form.displayName.trim(),
      })

      // Drop the password from state the moment it's no longer needed. It is
      // never logged, never put in the URL, and never carried into the
      // confirmation — the admin chose it, so we only remind them of that.
      setForm({ displayName: '', email: '', password: '' })

      navigate('/organizers', {
        replace: true,
        state: {
          flash: `Organizer created — ${email}. Share the password you set with them; it can't be viewed again, only reset.`,
        },
      })
    } catch (err) {
      if (isConflict(err)) {
        setFieldErrors({ email: 'An organizer with this email already exists.' })
      } else {
        setFormError(errorMessage(err, "Couldn't create the organizer."))
      }
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title="Create organizer" description="They'll use these credentials to sign in to the organizer dashboard." />

      <div className="max-w-lg">
        <Link to="/organizers" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to organizers
        </Link>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label="Display name"
            value={form.displayName}
            onChange={set('displayName')}
            error={fieldErrors.displayName}
            hint="The business name organizers and attendees will see."
            disabled={submitting}
            placeholder="Sunburn Events"
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
            hint="Their login for the organizer dashboard."
            disabled={submitting}
            placeholder="bookings@sunburn.in"
          />

          <Field
            label="Initial password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={fieldErrors.password}
            hint={`At least ${MIN_PASSWORD} characters. You'll need to pass this to them yourself — it can't be retrieved later, only reset.`}
            disabled={submitting}
            placeholder="••••••••"
          />

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={submitting}>
              {submitting ? 'Creating…' : 'Create organizer'}
            </Button>
            <Button variant="secondary" to="/organizers">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
