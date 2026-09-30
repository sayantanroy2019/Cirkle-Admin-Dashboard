import { useCallback, useRef, useState } from 'react'
import { getMenu, uploadMenu, createMenuItem, updateMenuItem, deleteMenuItem, uploadErrors } from '../../api/fnb'
import useAsync from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { formatPaise, paiseToRupeeInput, rupeeInputToPaise } from '../../lib/format'
import { downloadXlsx, readXlsxRows, slugForFilename } from '../../lib/exportXlsx'
import Button from '../Button'
import Alert from '../Alert'
import Spinner from '../Spinner'

/**
 * Menus (spec §1.4): each stall's category · item · price list. Two ways
 * in — the whole-event sheet (template pre-filled with stall names;
 * replace-per-stall-present, all-or-nothing) or stall-by-stall by hand.
 * Removing an item archives it; sales history is never rewritten.
 */
export default function MenusTab({ event, onChanged }) {
  const fetcher = useCallback(() => getMenu(event.id), [event.id])
  const { data: stalls, loading, error, reload } = useAsync(fetcher)
  const [notice, setNotice] = useState(null)
  const say = (text, tone = 'success') => setNotice({ tone, text })
  const refresh = async () => { await reload(); await onChanged?.() }

  if (loading && !stalls) return <p className="flex items-center gap-2 text-sm text-gray-500"><Spinner className="size-4" />Loading menus…</p>
  if (error) return <p className="text-sm text-red-600">{errorMessage(error, "Couldn't load the menus.")}</p>

  return (
    <div className="space-y-6">
      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      {stalls.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          No stalls yet. Create stall counter users first — each stall name becomes a stall the menu can attach to.
        </p>
      ) : (
        <>
          <SheetUpload event={event} stalls={stalls} onDone={refresh} say={say} />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Stall by stall</h2>
            {stalls.map((s) => <StallEditor key={s.id} stall={s} onChanged={refresh} say={say} />)}
          </section>
        </>
      )}
    </div>
  )
}

function SheetUpload({ event, stalls, onDone, say }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [sheetRows, setSheetRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [rowErrors, setRowErrors] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const template = () => downloadXlsx({
    filename: `${slugForFilename(event.name)}_menu_template.xlsx`,
    sheetName: 'Menu',
    headers: ['stall', 'category', 'item', 'price'],
    // One starter row per stall — the admin adds as many rows per stall as needed.
    rows: stalls.map((s) => ({ stall: s.name, category: '', item: '', price: '' })),
  })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setRowErrors(null)
    try {
      const parsed = await readXlsxRows(file)
      const local = []
      const mapped = []
      const sheetRows = []   // mapped[i] came from spreadsheet row sheetRows[i] (header is row 1)
      parsed.forEach((r, i) => {
        const stall = String(r.stall ?? '').trim(), category = String(r.category ?? '').trim(), item = String(r.item ?? '').trim()
        const priceRaw = r.price
        // A row with only the stall filled in is the template's scaffolding
        // (or a stall the admin left empty on purpose). Skipping it keeps that
        // stall out of the sheet, so the backend leaves its menu untouched
        // rather than archiving everything.
        if (!category && !item && (priceRaw === '' || priceRaw === undefined)) return
        const pricePaise = rupeeInputToPaise(String(priceRaw ?? '').trim())
        if (pricePaise === null) local.push({ row: i + 2, reason: `price "${priceRaw}" is not a valid rupee amount` })
        mapped.push({ stall, category, item, pricePaise })
        sheetRows.push(i + 2)
      })
      if (local.length) { setRowErrors(local); return }
      if (mapped.length === 0) { setErr('No rows found. The sheet needs stall, category, item and price columns.'); return }
      setRows(mapped); setSheetRows(sheetRows); setFileName(file.name)
    } catch (e2) { setErr(errorMessage(e2, "Couldn't read that file.")) }
  }

  const upload = async () => {
    setBusy(true); setErr(''); setRowErrors(null)
    try {
      const r = await uploadMenu(event.id, rows)
      say(`Menu uploaded for ${r.summary.stalls} stall(s): ${r.summary.added} added, ${r.summary.updated} updated, ${r.summary.archived} removed.`)
      setRows(null); setFileName('')
      if (fileRef.current) fileRef.current.value = ''
      await onDone()
    } catch (e2) {
      const errs = uploadErrors(e2)
      // The backend numbers the rows it received; translate back to the sheet.
      if (errs) setRowErrors(errs.map((e) => ({ ...e, row: sheetRows[e.row - 1] ?? e.row })))
      else setErr(errorMessage(e2, "Couldn't upload the menu."))
    } finally { setBusy(false) }
  }

  const stallsInSheet = rows ? new Set(rows.map((r) => r.stall.toLowerCase())).size : 0

  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Upload the whole menu</h2>
      <p className="mt-1 text-xs text-gray-500">
        Download the template (stall names already filled in), add category, item and price rows under each stall, then upload.
        The sheet becomes the complete menu for every stall it mentions — items not in the sheet are removed from those stalls; stalls not in the sheet are untouched. Past sales are never changed.
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
          <p className="text-gray-700"><span className="font-semibold">{rows.length}</span> items across <span className="font-semibold">{stallsInSheet}</span> stall(s) ready.</p>
          <div className="mt-2 flex gap-2">
            <Button onClick={upload} loading={busy}>{busy ? 'Uploading…' : 'Upload menu'}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>Cancel</Button>
          </div>
        </div>
      )}
      {rowErrors && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Nothing was changed — fix these rows and upload again:</p>
          <ul className="mt-1 list-inside list-disc text-xs">{rowErrors.map((e) => <li key={e.row}>Row {e.row}: {e.reason}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

function StallEditor({ stall, onChanged, say }) {
  const [form, setForm] = useState({ category: '', name: '', price: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(null)   // { id, category, name, price }

  const add = async (e) => {
    e.preventDefault()
    const pricePaise = rupeeInputToPaise(form.price)
    if (!form.category.trim() || !form.name.trim()) { setErr('Category and item are required.'); return }
    if (pricePaise === null) { setErr('Enter a valid price in rupees.'); return }
    setBusy('add'); setErr('')
    try {
      await createMenuItem(stall.id, { category: form.category.trim(), name: form.name.trim(), pricePaise })
      setForm((f) => ({ ...f, name: '', price: '' }))   // keep the category for the next item
      await onChanged()
    } catch (e2) { setErr(errorMessage(e2, "Couldn't add the item.")) } finally { setBusy('') }
  }

  const saveEdit = async () => {
    const pricePaise = rupeeInputToPaise(editing.price)
    if (!editing.category.trim() || !editing.name.trim() || pricePaise === null) { setErr('Category, item and a valid price are required.'); return }
    setBusy(`edit:${editing.id}`); setErr('')
    try {
      await updateMenuItem(editing.id, { category: editing.category.trim(), name: editing.name.trim(), pricePaise })
      setEditing(null)
      await onChanged()
    } catch (e2) { setErr(errorMessage(e2, "Couldn't save the item.")) } finally { setBusy('') }
  }

  const toggleAvailable = async (item) => {
    setBusy(`avail:${item.id}`)
    try { await updateMenuItem(item.id, { isAvailable: !item.isAvailable }); await onChanged() }
    catch (e2) { setErr(errorMessage(e2, "Couldn't update the item.")) } finally { setBusy('') }
  }

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from ${stall.name}'s menu? Past sales keep it.`)) return
    setBusy(`del:${item.id}`)
    try { await deleteMenuItem(item.id); say(`Removed ${item.name}.`); await onChanged() }
    catch (e2) { setErr(errorMessage(e2, "Couldn't remove the item.")) } finally { setBusy('') }
  }

  const inputCls = 'rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none'

  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-gray-900">{stall.name}</h3>
        <span className="text-xs text-gray-500">{stall.items.length} items · {stall.userCount} login{stall.userCount === 1 ? '' : 's'}</span>
      </div>

      {stall.items.length > 0 && (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="pb-1.5 pr-3 font-medium">Category</th>
              <th className="pb-1.5 pr-3 font-medium">Item</th>
              <th className="pb-1.5 pr-3 font-medium text-right">Price</th>
              <th className="pb-1.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stall.items.map((item) => editing?.id === item.id ? (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3"><input className={inputCls} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></td>
                <td className="py-1.5 pr-3"><input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
                <td className="py-1.5 pr-3 text-right"><input className={`${inputCls} w-24 text-right`} inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></td>
                <td className="py-1.5 text-right text-xs whitespace-nowrap">
                  <button type="button" className="text-brand hover:underline" onClick={saveEdit} disabled={!!busy}>Save</button>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <button type="button" className="text-gray-500 hover:text-gray-900" onClick={() => setEditing(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={item.id} className={`border-b border-gray-100 last:border-b-0 ${item.isAvailable ? '' : 'text-gray-400'}`}>
                <td className="py-1.5 pr-3">{item.category}</td>
                <td className="py-1.5 pr-3">{item.name}{!item.isAvailable && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] uppercase text-gray-500">Sold out</span>}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatPaise(item.pricePaise)}</td>
                <td className="py-1.5 text-right text-xs whitespace-nowrap">
                  <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => setEditing({ id: item.id, category: item.category, name: item.name, price: paiseToRupeeInput(item.pricePaise) })} disabled={!!busy}>Edit</button>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => toggleAvailable(item)} disabled={!!busy}>{item.isAvailable ? 'Mark sold out' : 'Mark available'}</button>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => remove(item)} disabled={!!busy}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-600">Category<br /><input className={`${inputCls} mt-1`} value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setErr('') }} placeholder="Drinks" /></label>
        <label className="text-xs text-gray-600">Item<br /><input className={`${inputCls} mt-1`} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr('') }} placeholder="Masala Chai" /></label>
        <label className="text-xs text-gray-600">Price (₹)<br /><input className={`${inputCls} mt-1 w-28`} inputMode="decimal" value={form.price} onChange={(e) => { setForm({ ...form, price: e.target.value }); setErr('') }} placeholder="50" /></label>
        <Button type="submit" variant="secondary" loading={busy === 'add'}>Add item</Button>
      </form>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  )
}
