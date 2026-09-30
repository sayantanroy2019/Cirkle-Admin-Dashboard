import { useCallback, useRef, useState } from 'react'
import {
  listCounterUsers, createCounterUser, bulkCreateCounterUsers, exportCounterUsers,
  disableAllCounterUsers, revealCounterUser, rotateCounterUser, updateCounterUser,
  deleteCounterUser, uploadErrors, listStalls,
} from '../../api/fnb'
import useAsync from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { downloadXlsx, readXlsxRows, slugForFilename, todayForFilename } from '../../lib/exportXlsx'
import Button from '../Button'
import Alert from '../Alert'
import Badge from '../Badge'
import Field from '../Field'
import Spinner from '../Spinner'

/**
 * Counter users for one event (spec §1.2 top-up, §1.3 stall):
 *   1. create individually — only the name / stall is required
 *   2. bulk: download template → fill names → upload (all-or-nothing)
 *   3. view all — passwords masked; Show/Copy/Export only for admins who may
 *      reveal (administrative), every reveal audited server-side.
 */
const LABELS = {
  topup: { one: 'top‑up user', many: 'top‑up users', nameLabel: 'Name', nameKey: 'name', help: 'One login per volunteer. Every top‑up is attributed to the person.' },
  stall: { one: 'stall counter user', many: 'stall counter users', nameLabel: 'Stall', nameKey: 'stall', help: 'One login per stall, shared by whoever is on shift. Typing a new stall name creates the stall; the menu attaches to it on the Menus tab.' },
}

const MASK = '••••••'

export default function CounterUsersTab({ event, kind, onChanged }) {
  const L = LABELS[kind]
  const fetcher = useCallback(() => listCounterUsers(event.id, kind), [event.id, kind])
  const { data, loading, error, reload } = useAsync(fetcher)
  const users = data?.users ?? []
  const canReveal = data?.canReveal ?? false

  const [notice, setNotice] = useState(null)   // { tone, text }
  const [revealed, setRevealed] = useState({})  // userId -> password
  const [busy, setBusy] = useState('')          // `${action}:${id}`

  const refresh = async () => { await reload(); await onChanged?.() }
  const say = (text, tone = 'success') => setNotice({ tone, text })

  /* ── per-row actions ── */
  const act = async (key, fn) => {
    setBusy(key)
    setNotice(null)
    try { await fn() } catch (err) { say(errorMessage(err, 'That didn’t work.'), 'error') } finally { setBusy('') }
  }
  const show = (u) => act(`show:${u.id}`, async () => {
    const r = await revealCounterUser(u.id)
    setRevealed((m) => ({ ...m, [u.id]: r.password }))
  })
  const copy = async (u) => {
    let password = revealed[u.id]
    if (!password) { const r = await revealCounterUser(u.id); password = r.password; setRevealed((m) => ({ ...m, [u.id]: password })) }
    await navigator.clipboard?.writeText(`${u.username} / ${password}`)
    say(`Copied ${u.username} and its password.`)
  }
  const rotate = (u) => {
    if (!window.confirm(`Give ${u.username} a new PIN? The current one stops working immediately.`)) return
    return act(`rotate:${u.id}`, async () => {
      const r = await rotateCounterUser(u.id)
      if (r.password) setRevealed((m) => ({ ...m, [u.id]: r.password }))
      say(r.password ? `New PIN for ${u.username}: ${r.password}` : `PIN rotated for ${u.username}.`)
      await reload()
    })
  }
  const toggle = (u) => act(`toggle:${u.id}`, async () => { await updateCounterUser(u.id, { isActive: !u.isActive }); await reload() })
  const remove = (u) => {
    if (!window.confirm(`Delete ${u.username}? If this login has already transacted, disable it instead.`)) return
    return act(`delete:${u.id}`, async () => { await deleteCounterUser(u.id); setRevealed((m) => { const c = { ...m }; delete c[u.id]; return c }); await refresh() })
  }
  const disableAll = () => {
    if (!window.confirm(`Disable ALL ${L.many} on this event? Their logins stop working until re-enabled.`)) return
    return act('disable-all', async () => { const r = await disableAllCounterUsers(event.id, kind); say(`Disabled ${r.disabled} ${L.many}.`); await reload() })
  }
  const exportAll = () => act('export', async () => {
    const rows = await exportCounterUsers(event.id, kind)
    await downloadXlsx({
      filename: `${slugForFilename(event.name)}_${kind}-users_${todayForFilename()}.xlsx`,
      sheetName: L.many,
      headers: [L.nameLabel, 'Username', 'Password', 'Status'],
      rows: rows.map((u) => ({ [L.nameLabel]: kind === 'topup' ? u.displayName : u.stall?.name, Username: u.username, Password: u.password, Status: u.isActive ? 'Active' : 'Disabled' })),
    })
    say(`Downloaded ${rows.length} ${L.many} with passwords. Handle that file carefully.`)
  })

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{L.help}</p>
      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateOne event={event} kind={kind} L={L} canReveal={canReveal} onCreated={refresh} say={say} />
        <BulkUpload event={event} kind={kind} L={L} canReveal={canReveal} onCreated={refresh} say={say} />
      </div>

      <section className="rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">All {L.many} <span className="ml-1 text-gray-400">{users.length}</span></h2>
          <div className="flex gap-2">
            {canReveal && <Button variant="secondary" onClick={exportAll} loading={busy === 'export'} disabled={users.length === 0}>Download credentials</Button>}
            <Button variant="secondary" onClick={disableAll} loading={busy === 'disable-all'} disabled={users.every((u) => !u.isActive)}>Disable all</Button>
          </div>
        </div>
        {!canReveal && (
          <p className="mt-2 text-xs text-gray-500">Passwords are visible to administrative admins only.</p>
        )}

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-gray-500"><Spinner className="size-4" />Loading…</p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-600">{errorMessage(error, "Couldn't load users.")}</p>
        ) : users.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">No {L.many} yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">{L.nameLabel}</th>
                  <th className="pb-2 pr-4 font-medium">Username</th>
                  <th className="pb-2 pr-4 font-medium">Password</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Last login</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 pr-4 text-gray-900">{kind === 'topup' ? u.displayName : u.stall?.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{u.username}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {revealed[u.id] ? (
                        <span className="text-gray-900">{revealed[u.id]}</span>
                      ) : (
                        <span className="text-gray-400">{MASK}</span>
                      )}
                      {canReveal && (
                        <span className="ml-2 space-x-2 font-sans text-xs">
                          {!revealed[u.id] && <button type="button" className="text-brand hover:underline" onClick={() => show(u)} disabled={busy === `show:${u.id}`}>Show</button>}
                          <button type="button" className="text-brand hover:underline" onClick={() => copy(u)}>Copy</button>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {u.lockedUntil ? <Badge tone="amber" dot>Locked</Badge> : <Badge tone={u.isActive ? 'green' : 'gray'} dot>{u.isActive ? 'Active' : 'Disabled'}</Badge>}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                    <td className="py-2 text-right text-xs whitespace-nowrap">
                      <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => rotate(u)} disabled={!!busy}>Rotate PIN</button>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => toggle(u)} disabled={!!busy}>{u.isActive ? 'Disable' : 'Enable'}</button>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => remove(u)} disabled={!!busy}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function CreateOne({ event, kind, L, canReveal, onCreated, say }) {
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErr('') }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErr(`Enter the ${L.nameLabel.toLowerCase()}.`); return }
    setBusy(true)
    try {
      const r = await createCounterUser(event.id, { kind, [L.nameKey]: form.name.trim(), username: form.username.trim() || undefined, password: form.password || undefined })
      say(r.password ? `Created ${r.user.username} — PIN ${r.password}` : `Created ${r.user.username}.`)
      setForm({ name: '', username: '', password: '' })
      await onCreated()
    } catch (e2) {
      setErr(errorMessage(e2, `Couldn't create the ${L.one}.`))
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Create one</h2>
      <p className="mt-1 text-xs text-gray-500">Only the {L.nameLabel.toLowerCase()} is required. Leave username and password blank to generate them ({event.code}-… and a 6‑digit PIN).</p>
      <div className="mt-3 space-y-3">
        <Field label={L.nameLabel} value={form.name} onChange={set('name')} disabled={busy} error={err} autoComplete="off" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username (optional)" value={form.username} onChange={set('username')} disabled={busy} placeholder={`${event.code}-…`} autoComplete="off" />
          <Field label="Password (optional)" value={form.password} onChange={set('password')} disabled={busy} placeholder="6‑digit PIN if blank" autoComplete="off" />
        </div>
      </div>
      <Button type="submit" className="mt-4" loading={busy}>{busy ? 'Creating…' : `Create ${L.one}`}</Button>
      {!canReveal && <p className="mt-2 text-xs text-gray-500">The generated PIN is shown only to administrative admins.</p>}
    </form>
  )
}

function BulkUpload({ event, kind, L, canReveal, onCreated, say }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)         // parsed, not yet uploaded
  const [sheetRows, setSheetRows] = useState([]) // rows[i] came from spreadsheet row sheetRows[i] (header is row 1)
  const [fileName, setFileName] = useState('')
  const [rowErrors, setRowErrors] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)

  const template = async () => {
    setErr('')
    try {
      let prefill = []
      if (kind === 'stall') {
        const stalls = await listStalls(event.id)
        prefill = stalls.map((s) => ({ stall: s.name, username: '', password: '' }))
      }
      if (prefill.length === 0) prefill = [{ [L.nameKey]: kind === 'topup' ? 'Rahul Sharma' : 'Chai Corner', username: '', password: '' }]
      await downloadXlsx({
        filename: `${slugForFilename(event.name)}_${kind}-users_template.xlsx`,
        sheetName: 'Template',
        headers: [L.nameKey, 'username', 'password'],
        rows: prefill,
      })
    } catch (e2) { setErr(errorMessage(e2, "Couldn't build the template.")) }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setRowErrors(null); setCreated(null)
    try {
      const parsed = await readXlsxRows(file)
      const mapped = []
      const origin = []
      parsed.forEach((r, i) => {
        const row = { [L.nameKey]: String(r[L.nameKey] ?? r.name ?? r.stall ?? '').trim(), username: String(r.username ?? '').trim(), password: String(r.password ?? '').trim() }
        if (!row[L.nameKey] && !row.username && !row.password) return   // blank line
        mapped.push(row)
        origin.push(i + 2)
      })
      if (mapped.length === 0) { setErr(`No rows found. The sheet needs a "${L.nameKey}" column.`); return }
      setRows(mapped)
      setSheetRows(origin)
      setFileName(file.name)
    } catch (e2) { setErr(errorMessage(e2, "Couldn't read that file.")) }
  }

  const upload = async () => {
    setBusy(true); setErr(''); setRowErrors(null)
    try {
      const r = await bulkCreateCounterUsers(event.id, kind, rows)
      setCreated(r.created)
      setRows(null); setFileName('')
      if (fileRef.current) fileRef.current.value = ''
      say(`Created ${r.created.length} ${L.many}.`)
      await onCreated()
    } catch (e2) {
      const errs = uploadErrors(e2)
      // The backend numbers the rows it received; translate back to the sheet.
      if (errs) setRowErrors(errs.map((e) => ({ ...e, row: sheetRows[e.row - 1] ?? e.row })))
      else setErr(errorMessage(e2, "Couldn't upload the sheet."))
    } finally { setBusy(false) }
  }

  const downloadCreated = () => downloadXlsx({
    filename: `${slugForFilename(event.name)}_${kind}-users_created_${todayForFilename()}.xlsx`,
    sheetName: 'Credentials',
    headers: [L.nameLabel, 'Username', 'Password'],
    rows: created.map((c) => ({ [L.nameLabel]: c.name ?? c.stall, Username: c.username, Password: c.password ?? '' })),
  })

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Bulk upload</h2>
      <p className="mt-1 text-xs text-gray-500">
        Download the template, fill in the {L.nameLabel.toLowerCase()} column (username and password may stay blank — they're generated), then upload. If any row is wrong, nothing is created.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={template}>Download template</Button>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Choose file…
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={onFile} />
        </label>
        {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {rows && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="text-gray-700"><span className="font-semibold">{rows.length}</span> rows ready · {rows.filter((r) => !r.username).length} usernames and {rows.filter((r) => !r.password).length} passwords will be generated.</p>
          <div className="mt-2 flex gap-2">
            <Button onClick={upload} loading={busy}>{busy ? 'Uploading…' : `Create ${rows.length} ${L.many}`}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>Cancel</Button>
          </div>
        </div>
      )}

      {rowErrors && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Nothing was created — fix these rows and upload again:</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {rowErrors.map((e) => <li key={e.row}>Row {e.row}: {e.reason}</li>)}
          </ul>
        </div>
      )}

      {created && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-green-900">{created.length} created</p>
            {canReveal && <Button variant="secondary" onClick={downloadCreated}>Download credentials</Button>}
          </div>
          <div className="mt-2 max-h-48 overflow-auto">
            <table className="w-full text-xs">
              <tbody>
                {created.map((c) => (
                  <tr key={c.id}><td className="pr-3 py-0.5">{c.name ?? c.stall}</td><td className="pr-3 font-mono">{c.username}</td><td className="font-mono">{canReveal ? c.password : MASK}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
