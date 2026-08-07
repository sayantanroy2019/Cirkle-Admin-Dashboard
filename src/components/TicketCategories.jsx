import { useEffect, useMemo, useState } from 'react'
import { createTicketCategory, listTicketCategories } from '../api/ticketCategories'
import { updateEvent } from '../api/events'
import { errorMessage, isConflict } from '../lib/errors'
import {
  MAX_EVENT_CATEGORIES,
  QUANTITY_STATE,
  buildCapacitySummary,
  categoryToRow,
  describeRow,
  describeTotal,
  newCategoryRow,
  previewableRows,
  rowToPayload,
  validateRow,
} from '../lib/capacity'
import Button from './Button'
import Alert from './Alert'
import Checkbox from './Checkbox'
import Spinner from './Spinner'

/**
 * Ticket categories for one event.
 *
 * One booking = one ticket = one QR. A category's `admitsCount` is how many
 * people that single ticket admits, and `ticketQuantity` is inventory counted
 * in *tickets*. Total capacity is derived — the admin never types it.
 *
 * PATCH replaces the event's whole category set, so this always sends every
 * row. A PATCH carrying only `categories` is valid and does not come back
 * "No fields to update".
 */
export default function TicketCategories({ eventId, categories, capacitySummary, onChange }) {
  const initial = useMemo(() => (categories ?? []).map(categoryToRow), [categories])

  const [rows, setRows] = useState(initial)
  const [rowErrors, setRowErrors] = useState({})
  const [catalog, setCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Inline "create a new catalogue name"
  const [creatingFor, setCreatingFor] = useState(null) // row uid
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState('')
  const [creating, setCreating] = useState(false)

  const loadCatalog = async () => {
    setCatalogLoading(true)
    setCatalogError('')
    try {
      setCatalog(await listTicketCategories(true))
    } catch (err) {
      setCatalogError(errorMessage(err, "Couldn't load the category list."))
    } finally {
      setCatalogLoading(false)
    }
  }
  useEffect(() => {
    loadCatalog()
  }, [])

  const patchRow = (uid, fields) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...fields } : r)))
    setSaved(false)
  }

  /* ── live derivation, mirroring the backend ── */
  const livePayload = previewableRows(rows)
  const liveSummary = buildCapacitySummary(livePayload)
  const total = describeTotal(liveSummary)

  // Names already used on this event can't be picked again — the backend
  // rejects the same categoryId twice.
  const takenIds = new Set(rows.map((r) => r.categoryId).filter(Boolean))

  const dirty =
    rows.length !== initial.length ||
    rows.some((r, i) => {
      const was = initial[i]
      if (!was) return true
      return (
        r.categoryId !== was.categoryId ||
        String(r.price) !== String(was.price) ||
        String(r.admits) !== String(was.admits) ||
        r.unlimited !== was.unlimited ||
        (!r.unlimited && String(r.quantity) !== String(was.quantity))
      )
    })

  const handleCreateName = async (uid) => {
    const name = newName.trim()
    if (!name) {
      setNewNameError('Enter a name.')
      return
    }
    setCreating(true)
    setNewNameError('')
    try {
      const created = await createTicketCategory(name)
      setCatalog((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      patchRow(uid, { categoryId: created.id, categoryName: created.name })
      setCreatingFor(null)
      setNewName('')
    } catch (err) {
      if (isConflict(err)) {
        // The name already exists — find it and just select it rather than
        // making the admin retype. Matching is case-insensitive server-side.
        const existing = (await listTicketCategories(true)).find(
          (c) => c.name.toLowerCase() === name.toLowerCase().replace(/\s+/g, ' '),
        )
        if (existing) {
          setCatalog((prev) =>
            prev.some((c) => c.id === existing.id) ? prev : [...prev, existing].sort((a, b) => a.name.localeCompare(b.name)),
          )
          if (takenIds.has(existing.id)) {
            setNewNameError('That category already exists and is already on this event.')
          } else {
            patchRow(uid, { categoryId: existing.id, categoryName: existing.name })
            setCreatingFor(null)
            setNewName('')
          }
        } else {
          setNewNameError('A category with this name already exists.')
        }
      } else {
        setNewNameError(errorMessage(err, "Couldn't create that category."))
      }
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    const errs = {}
    rows.forEach((r) => {
      const e = validateRow(r)
      if (Object.keys(e).length > 0) errs[r.uid] = e
    })
    setRowErrors(errs)
    setError('')
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      // `categories` replaces the whole set; [] clears it.
      const updated = await updateEvent(eventId, { categories: rows.map(rowToPayload) })
      // The backend's derived values are authoritative from here on.
      setRows((updated.categories ?? []).map(categoryToRow))
      onChange(updated)
      setSaved(true)
    } catch (err) {
      // 409 = the change would destroy sold tickets. Surface it verbatim.
      setError(errorMessage(err, "Couldn't save the ticket categories."))
    } finally {
      setSaving(false)
    }
  }

  const savedSummary = capacitySummary
  const savedTotal = savedSummary ? describeTotal(savedSummary) : null

  return (
    <div>
      {(error || catalogError) && (
        <Alert tone="error" className="mb-4" onDismiss={() => { setError(''); setCatalogError('') }}>
          {error || catalogError}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-4" onDismiss={() => setSaved(false)}>
          Ticket categories saved.
        </Alert>
      )}

      {catalogLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
          <Spinner className="size-4" />
          Loading categories…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-500">
          No ticket categories yet. An event can't be purchased until it has at least one.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const errs = rowErrors[row.uid] ?? {}
            const desc = describeRow(row)
            const isCreating = creatingFor === row.uid

            return (
              <li key={row.uid} className="rounded-lg border border-gray-200 p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-start">
                  {/* Category name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Category
                      <select
                        value={row.categoryId}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setCreatingFor(row.uid)
                            setNewName('')
                            setNewNameError('')
                            return
                          }
                          const picked = catalog.find((c) => c.id === e.target.value)
                          patchRow(row.uid, {
                            categoryId: e.target.value,
                            categoryName: picked?.name ?? '',
                          })
                        }}
                        disabled={saving}
                        className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:outline-none disabled:bg-gray-50 ${
                          errs.categoryId
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-brand focus:ring-brand'
                        }`}
                      >
                        <option value="">Choose a category</option>
                        {catalog.map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            disabled={takenIds.has(c.id) && c.id !== row.categoryId}
                          >
                            {c.name}
                            {takenIds.has(c.id) && c.id !== row.categoryId ? ' (already added)' : ''}
                          </option>
                        ))}
                        <option value="__new__">+ Create new category…</option>
                      </select>
                    </label>
                    {errs.categoryId && <p className="mt-1 text-xs text-red-600">{errs.categoryId}</p>}
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Price (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(e) => patchRow(row.uid, { price: e.target.value })}
                        disabled={saving}
                        placeholder="750"
                        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:outline-none disabled:bg-gray-50 ${
                          errs.price
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-brand focus:ring-brand'
                        }`}
                      />
                    </label>
                    {errs.price && <p className="mt-1 text-xs text-red-600">{errs.price}</p>}
                  </div>

                  {/* Admits */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Admits
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={row.admits}
                        onChange={(e) => patchRow(row.uid, { admits: e.target.value })}
                        disabled={saving}
                        placeholder="1"
                        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:outline-none disabled:bg-gray-50 ${
                          errs.admits
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-brand focus:ring-brand'
                        }`}
                      />
                    </label>
                    {errs.admits && <p className="mt-1 text-xs text-red-600">{errs.admits}</p>}
                  </div>

                  {/* Tickets / Unlimited */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600">
                      Tickets
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={row.unlimited ? '' : row.quantity}
                        onChange={(e) => patchRow(row.uid, { quantity: e.target.value })}
                        disabled={saving || row.unlimited}
                        placeholder={row.unlimited ? 'Unlimited' : '50'}
                        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 ${
                          errs.quantity
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-brand focus:ring-brand'
                        }`}
                      />
                    </label>
                    <Checkbox
                      className="mt-1.5"
                      label={<span className="text-xs">Unlimited</span>}
                      checked={row.unlimited}
                      disabled={saving}
                      onChange={(e) => patchRow(row.uid, { unlimited: e.target.checked })}
                    />
                    {errs.quantity && <p className="mt-1 text-xs text-red-600">{errs.quantity}</p>}
                  </div>

                  <div className="sm:pt-5">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                      disabled={saving}
                      className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:text-red-600 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Inline create-a-name */}
                {isCreating && (
                  <div className="mt-3 rounded-lg border border-brand/30 bg-brand-light/40 p-3">
                    <label className="block text-xs font-medium text-gray-700">
                      New category name
                      <input
                        value={newName}
                        onChange={(e) => { setNewName(e.target.value); setNewNameError('') }}
                        disabled={creating}
                        placeholder="Couple Pass"
                        autoComplete="off"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                    </label>
                    {newNameError && <p className="mt-1 text-xs text-red-600">{newNameError}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button loading={creating} onClick={() => handleCreateName(row.uid)}>
                        {creating ? 'Creating…' : 'Create'}
                      </Button>
                      <Button variant="secondary" disabled={creating} onClick={() => setCreatingFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* The live derivation for this tier */}
                <p
                  className={`mt-2 text-xs ${
                    desc?.state === QUANTITY_STATE.UNLIMITED
                      ? 'font-medium text-brand'
                      : desc?.state === QUANTITY_STATE.ZERO
                        ? 'text-amber-700'
                        : 'text-gray-600'
                  }`}
                >
                  {desc ? desc.text : <span className="text-gray-400">Fill in admits and tickets to see the capacity.</span>}
                  {row.ticketsSold > 0 && (
                    <span className="ml-2 text-gray-500">· {row.ticketsSold} sold</span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {/* Running event total */}
      {/* Derived, never typed. aria-live so the running figure is announced as
          the admin edits, not just visible. */}
      <div
        className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3"
        aria-live="polite"
        aria-label="Total capacity"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Total capacity
          </span>
          <span className="text-lg font-semibold text-gray-900 tabular-nums">
            {total.headline}
          </span>
        </div>
        {total.detail && <p className="mt-0.5 text-right text-xs text-gray-500">{total.detail}</p>}
        <p className="mt-1 text-xs text-gray-400">
          Derived from the categories above — there's nothing to type here.
          {dirty && savedTotal && ` Saved: ${savedTotal.headline}.`}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={saving || rows.length >= MAX_EVENT_CATEGORIES || catalogLoading}
          onClick={() => setRows((prev) => [...prev, newCategoryRow()])}
        >
          Add category
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>
          {saving ? 'Saving…' : 'Save ticket categories'}
        </Button>
        {dirty && (
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => { setRows(initial); setRowErrors({}); setError('') }}
          >
            Discard changes
          </Button>
        )}
        <p className="text-xs text-gray-500">
          {rows.length}/{MAX_EVENT_CATEGORIES}
        </p>
      </div>
    </div>
  )
}
