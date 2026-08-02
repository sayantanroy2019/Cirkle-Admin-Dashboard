/** Cirkle is an Indian platform, so dates and money read in the local convention. */
const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d)
}

export const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATETIME_FMT.format(d)
}

/* ── Money ──────────────────────────────────────────────────────────────
   The backend stores and returns `price` in PAISE as an integer (₹500 =
   50000). Admins think in rupees, so the forms take rupees and convert at
   the boundary. Keep every conversion in these three helpers — a stray
   ×100 somewhere else is how an event ends up priced at ₹50,000.        */

/** 50000 → "₹500" (paise in, display string out). */
export const formatPaise = (paise) => {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '—'
  const rupees = paise / 100
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** 50000 → "500" for a rupee-denominated form input. */
export const paiseToRupeeInput = (paise) => {
  if (paise === null || paise === undefined) return ''
  return String(paise % 100 === 0 ? paise / 100 : (paise / 100).toFixed(2))
}

/** "500" or "500.50" → 50000 / 50050. Returns null when unparseable. */
export const rupeeInputToPaise = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const rupees = Number(trimmed)
  if (Number.isNaN(rupees) || rupees < 0) return null
  return Math.round(rupees * 100)
}

/* ── Datetimes ──────────────────────────────────────────────────────────
   The API speaks ISO 8601 (UTC). <input type="datetime-local"> speaks
   "YYYY-MM-DDTHH:mm" in the browser's local zone, with no offset.       */

/** ISO → the local "YYYY-MM-DDTHH:mm" an <input type="datetime-local"> wants. */
export const isoToLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** Local "YYYY-MM-DDTHH:mm" → ISO for the API. Returns null when unparseable. */
export const localInputToIso = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* ── Event display helpers ─────────────────────────────────────────── */

export const EVENT_TYPE_LABELS = {
  open: 'Open',
  invite_only: 'Invite-only',
}

/** The list has no status field — it's derived from startsAt vs now. */
export const isPast = (startsAt) => {
  if (!startsAt) return false
  const d = new Date(startsAt)
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now()
}
