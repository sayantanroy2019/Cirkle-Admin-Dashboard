import { formatPaise, rupeeInputToPaise } from './format'

/**
 * Client-side capacity derivation, mirroring the backend exactly.
 *
 * This exists so the admin watches the numbers add up while typing. It is a
 * *preview only* — after any save the backend's `peopleCapacity` /
 * `capacitySummary` are the source of truth and get reflected straight back
 * into the form. But the two must agree, or the displayed number visibly jumps
 * on save, which reads as a bug.
 *
 * The backend rule (src/utils/eventCategories.js), reproduced here verbatim:
 *
 *   peopleCapacity = isUnlimited ? null : admitsCount × ticketQuantity
 *   finite         = categories where !isUnlimited
 *   totalTickets   = Σ finite ticketQuantity
 *   totalPeople    = Σ finite peopleCapacity
 *   hasUnlimited   = any category unlimited
 *
 * Note that unlimited tiers are *excluded* from the sums rather than treated as
 * infinity, so the finite subtotal stays meaningful and `hasUnlimited` tells
 * the UI to show the headline total as "Unlimited".
 */

export const MAX_EVENT_CATEGORIES = 20

/* ── The three inventory states ──────────────────────────────────────────
   null → unlimited · 0 → exists but nothing to sell · N > 0 → capped.
   `null` and `0` are opposites and must never be conflated.              */

export const QUANTITY_STATE = {
  UNLIMITED: 'unlimited',
  ZERO: 'zero',
  CAPPED: 'capped',
}

export const quantityState = (ticketQuantity) => {
  if (ticketQuantity === null || ticketQuantity === undefined) return QUANTITY_STATE.UNLIMITED
  if (Number(ticketQuantity) === 0) return QUANTITY_STATE.ZERO
  return QUANTITY_STATE.CAPPED
}

/** peopleCapacity for one tier. null when unlimited — not 0, which is the opposite. */
export const peopleCapacityOf = (admitsCount, ticketQuantity) =>
  ticketQuantity === null || ticketQuantity === undefined
    ? null
    : Number(admitsCount) * Number(ticketQuantity)

/**
 * Event rollup from an array of `{ admitsCount, ticketQuantity }`.
 * Shape matches the backend's capacitySummary so the two can be compared
 * directly in tests.
 */
export const buildCapacitySummary = (categories) => {
  const finite = categories.filter((c) => quantityState(c.ticketQuantity) !== QUANTITY_STATE.UNLIMITED)
  return {
    totalTickets: finite.reduce((sum, c) => sum + Number(c.ticketQuantity), 0),
    totalPeople: finite.reduce((sum, c) => sum + peopleCapacityOf(c.admitsCount, c.ticketQuantity), 0),
    hasUnlimited: categories.some(
      (c) => quantityState(c.ticketQuantity) === QUANTITY_STATE.UNLIMITED,
    ),
  }
}

/* ── Form rows ───────────────────────────────────────────────────────── */

let rowCounter = 0
export const newCategoryRow = () => ({
  uid: `new-${++rowCounter}`,
  categoryId: '',
  categoryName: '',
  price: '',
  admits: '1',
  quantity: '',
  unlimited: false,
  ticketsSold: 0,
})

/** An API category → form row. */
export const categoryToRow = (c) => ({
  uid: c.id ?? c.categoryId,
  categoryId: c.categoryId,
  categoryName: c.categoryName ?? '',
  price: c.pricePaise === null || c.pricePaise === undefined ? '' : String(c.pricePaise / 100),
  admits: String(c.admitsCount ?? 1),
  quantity: c.ticketQuantity === null || c.ticketQuantity === undefined ? '' : String(c.ticketQuantity),
  unlimited: c.ticketQuantity === null || c.ticketQuantity === undefined,
  ticketsSold: c.ticketsSold ?? 0,
})

/**
 * A row's numeric values in API terms, plus whether it's complete enough to
 * send. Incomplete rows are what the save-time validation blocks on.
 */
export const rowToPayload = (row) => ({
  categoryId: row.categoryId,
  pricePaise: rupeeInputToPaise(row.price),
  admitsCount: Number(String(row.admits).trim()),
  ticketQuantity: row.unlimited ? null : Number(String(row.quantity).trim()),
})

export const validateRow = (row) => {
  const errors = {}
  if (!row.categoryId) errors.categoryId = 'Choose a category.'

  const paise = rupeeInputToPaise(row.price)
  if (!String(row.price).trim()) errors.price = 'Enter a price.'
  else if (paise === null) errors.price = 'Enter a valid amount in rupees.'

  const admits = Number(String(row.admits).trim())
  if (!String(row.admits).trim()) errors.admits = 'Enter how many people this admits.'
  else if (!Number.isInteger(admits) || admits < 1) errors.admits = 'Must be a whole number, 1 or more.'

  if (!row.unlimited) {
    const qty = Number(String(row.quantity).trim())
    if (!String(row.quantity).trim()) errors.quantity = 'Enter a number of tickets, or mark it unlimited.'
    else if (!Number.isInteger(qty) || qty < 0) errors.quantity = 'Must be a whole number, 0 or more.'
  }

  return errors
}

/** Only rows complete enough to contribute to the live preview. */
export const previewableRows = (rows) =>
  rows.filter((r) => Object.keys(validateRow(r)).length === 0).map(rowToPayload)

/* ── Display ─────────────────────────────────────────────────────────── */

/** The live "50 tickets × admits 2 = 100 people" line for one row. */
export const describeRow = (row) => {
  const errs = validateRow(row)
  if (errs.admits || (!row.unlimited && errs.quantity)) return null

  const admits = Number(String(row.admits).trim())
  if (row.unlimited) return { state: QUANTITY_STATE.UNLIMITED, text: 'Unlimited tickets' }

  const qty = Number(String(row.quantity).trim())
  if (qty === 0) return { state: QUANTITY_STATE.ZERO, text: '0 tickets — nothing to sell' }

  return {
    state: QUANTITY_STATE.CAPPED,
    text: `${qty} ticket${qty === 1 ? '' : 's'} × admits ${admits} = ${qty * admits} people`,
  }
}

/** The headline event total. Reads "Unlimited" if any tier is uncapped. */
export const describeTotal = (summary) => {
  const tickets = `${summary.totalTickets} ticket${summary.totalTickets === 1 ? '' : 's'}`
  const people = `${summary.totalPeople} ${summary.totalPeople === 1 ? 'person' : 'people'}`
  if (summary.hasUnlimited) {
    return {
      headline: 'Unlimited',
      detail: `${tickets} · ${people} across the capped tiers`,
    }
  }
  return { headline: `${tickets} · ${people}`, detail: null }
}

/**
 * List-row display for `priceRange`.
 *
 * Returns null when the event has no categories — `priceRange: null` is the
 * authoritative "not configured yet" signal, and is deliberately distinct from
 * a real ₹0 or a sold-out tier. Callers render their own no-categories
 * affordance for null rather than a misleading number.
 */
export const describePriceRange = (priceRange) => {
  if (!priceRange) return null
  const { minPaise, maxPaise } = priceRange
  if (minPaise === null || minPaise === undefined) return null
  return minPaise === maxPaise
    ? formatPaise(minPaise)
    : `${formatPaise(minPaise)} – ${formatPaise(maxPaise)}`
}

/**
 * List-row display for `capacitySummary`.
 *
 * `hasUnlimited` wins outright — showing the finite subtotal as if it were the
 * event total would understate it. Returns null for a category-less event so
 * the caller can show the same affordance as the price column.
 */
export const describeCapacityCell = (summary, priceRange) => {
  if (!summary || !priceRange) return null
  if (summary.hasUnlimited) return { people: 'Unlimited', tickets: null }
  return {
    people: `${summary.totalPeople} ${summary.totalPeople === 1 ? 'person' : 'people'}`,
    tickets: `${summary.totalTickets} ticket${summary.totalTickets === 1 ? '' : 's'}`,
  }
}

export const formatRowPrice = (row) => {
  const paise = rupeeInputToPaise(row.price)
  return paise === null ? '—' : formatPaise(paise)
}
