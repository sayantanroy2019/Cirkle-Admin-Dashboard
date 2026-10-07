import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getFnbEvent, updateFnbEvent } from '../../api/fnb'
import useAsync from '../../hooks/useAsync'
import { errorMessage, isConflict } from '../../lib/errors'
import { titleCaseOrDash } from '../../lib/format'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/Button'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import Spinner from '../../components/Spinner'
import Tabs from '../../components/Tabs'
import FnbEventForm, { eventToForm, validateForm, formToPayload } from '../../components/fnb/FnbEventForm'
import CounterUsersTab from '../../components/fnb/CounterUsersTab'
import MenusTab from '../../components/fnb/MenusTab'
import SalesTab from '../../components/fnb/SalesTab'
import { FNB_STATUS_TONE } from './FnbEventsPage'

const STATUS_HELP = {
  draft: 'Setting up. Counter logins work but cannot transact.',
  live: 'Transacting. Top‑up and stall counters are taking money.',
  ended: 'Closed. Counters are locked; you can reopen at any time.',
}

// The four sections of spec §1 live as tabs. "Dashboard access" (§1.5) is
// the organizer field on the Details tab — the linked account sees the event
// in the organizer dashboard's F&B section.
const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'topup', label: 'Top‑up users' },
  { id: 'stall', label: 'Stall counter users' },
  { id: 'menu', label: 'Menus' },
  // Part 3: every bill at the event, and the only place a bill is reversed.
  { id: 'sales', label: 'Sales' },
]

export default function FnbEventDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'details'
  const setTab = (t) => setParams(t === 'details' ? {} : { tab: t }, { replace: true })

  const fetcher = useCallback(() => getFnbEvent(id), [id])
  const { data: event, loading, error, reload } = useAsync(fetcher)

  const [statusBusy, setStatusBusy] = useState('')
  const [statusError, setStatusError] = useState('')

  const changeStatus = async (status) => {
    if (statusBusy || event.status === status) return
    const message = status === 'live'
      ? 'Set this event LIVE? Top‑up and stall counters will be able to transact immediately.'
      : status === 'ended'
        ? 'END this event? Every counter locks — no more top‑ups or payments until you set it Live again.'
        : 'Move this event back to DRAFT? Counters will be locked.'
    if (!window.confirm(message)) return
    setStatusBusy(status)
    setStatusError('')
    try {
      await updateFnbEvent(id, { status })
      await reload()
    } catch (err) {
      setStatusError(errorMessage(err, "Couldn't change the status."))
    } finally {
      setStatusBusy('')
    }
  }

  if (loading && !event) {
    return <p className="flex items-center gap-2 py-16 text-sm text-gray-500"><Spinner />Loading event…</p>
  }
  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{errorMessage(error, "Couldn't load this F&B event.")}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={reload}>Try again</Button>
          <Button variant="secondary" to="/fnb">Back to F&B events</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title={event.name} description={STATUS_HELP[event.status]}>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={FNB_STATUS_TONE[event.status] ?? 'gray'} dot>{titleCaseOrDash(event.status)}</Badge>
          <div className="flex gap-2">
            {['draft', 'live', 'ended'].map((s) => (
              <Button
                key={s}
                variant={s === 'live' ? 'primary' : 'secondary'}
                disabled={event.status === s || !!statusBusy}
                loading={statusBusy === s}
                onClick={() => changeStatus(s)}
              >
                {s === 'live' ? 'Go live' : s === 'ended' ? 'End event' : 'Back to draft'}
              </Button>
            ))}
          </div>
        </div>
      </PageHeader>

      <Link to="/fnb" className="text-sm text-gray-500 hover:text-gray-900">← F&B events</Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
        <span>Code <span className="font-mono text-gray-800">{event.code}</span></span>
        <span>{event.counts.stalls} stalls · {event.counts.topupUsers} top‑up users · {event.counts.stallUsers} stall users · {event.counts.menuItems} menu items</span>
      </div>
      {statusError && <Alert tone="error" className="mt-4" onDismiss={() => setStatusError('')}>{statusError}</Alert>}

      <div className="mt-6">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            count: t.id === 'topup' ? event.counts.topupUsers : t.id === 'stall' ? event.counts.stallUsers : t.id === 'menu' ? event.counts.menuItems : undefined,
          }))}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-6">
        {tab === 'details' && <DetailsTab event={event} onSaved={reload} />}
        {tab === 'topup' && <CounterUsersTab event={event} kind="topup" onChanged={reload} />}
        {tab === 'stall' && <CounterUsersTab event={event} kind="stall" onChanged={reload} />}
        {tab === 'menu' && <MenusTab event={event} onChanged={reload} />}
        {tab === 'sales' && <SalesTab event={event} onChanged={reload} />}
      </div>
    </>
  )
}

function DetailsTab({ event, onSaved }) {
  const [form, setForm] = useState(eventToForm(event))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(eventToForm(event)) }, [event])

  const onChange = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
    setSaved(false)
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(eventToForm(event))

  const handleSave = async (e) => {
    e.preventDefault()
    const errs = validateForm(form)
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await updateFnbEvent(event.id, formToPayload(form))
      setSaved(true)
      await onSaved()
    } catch (err) {
      if (isConflict(err)) setErrors((x) => ({ ...x, code: 'That event code is already in use.' }))
      else setFormError(errorMessage(err, "Couldn't save the event."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="max-w-4xl space-y-5">
      {formError && <Alert tone="error" onDismiss={() => setFormError('')}>{formError}</Alert>}
      {saved && !dirty && <Alert onDismiss={() => setSaved(false)}>Event saved.</Alert>}
      <div className="rounded-xl border border-gray-200 p-5">
        <FnbEventForm form={form} errors={errors} onChange={onChange} disabled={saving} isEdit />
      </div>
      <div className="flex gap-3">
        <Button type="submit" loading={saving} disabled={!dirty}>{saving ? 'Saving…' : 'Save changes'}</Button>
        {dirty && <Button variant="secondary" disabled={saving} onClick={() => { setForm(eventToForm(event)); setErrors({}) }}>Discard</Button>}
      </div>
      <p className="text-xs text-gray-500">
        Changing the event code does not rename existing counter usernames — only usernames generated after the change use the new prefix.
      </p>
    </form>
  )
}
