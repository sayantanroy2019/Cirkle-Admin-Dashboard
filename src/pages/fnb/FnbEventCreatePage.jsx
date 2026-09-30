import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createFnbEvent } from '../../api/fnb'
import { errorMessage, isConflict } from '../../lib/errors'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/Button'
import Alert from '../../components/Alert'
import FnbEventForm, { eventToForm, validateForm, formToPayload } from '../../components/fnb/FnbEventForm'

export default function FnbEventCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(eventToForm(null))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const errs = validateForm(form)
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const created = await createFnbEvent(formToPayload(form))
      navigate(`/fnb/${created.id}`, { replace: true })
    } catch (err) {
      if (isConflict(err)) setErrors((e) => ({ ...e, code: 'That event code is already in use.' }))
      else setFormError(errorMessage(err, "Couldn't create the F&B event."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title="Create F&B event" description="It starts in Draft — nothing can transact until you set it Live." />
      <Link to="/fnb" className="text-sm text-gray-500 hover:text-gray-900">← F&B events</Link>

      <form onSubmit={handleSubmit} className="mt-4 max-w-4xl space-y-5">
        {formError && <Alert tone="error" onDismiss={() => setFormError('')}>{formError}</Alert>}
        <div className="rounded-xl border border-gray-200 p-5">
          <FnbEventForm form={form} errors={errors} onChange={onChange} disabled={submitting} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" loading={submitting}>{submitting ? 'Creating…' : 'Create event'}</Button>
          <Button variant="secondary" to="/fnb" disabled={submitting}>Cancel</Button>
        </div>
      </form>
    </>
  )
}
