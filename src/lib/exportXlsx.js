import { MAX_LIMIT } from '../api/oversight'

// SheetJS is ~400 KB and only needed when someone actually exports, so it is
// loaded on first use rather than shipped with every page of the portal.
const loadXlsx = () => import('xlsx')

/**
 * Table → Excel, for the oversight pages.
 *
 * The export is the TABLE, not the page: it re-runs the list query with the
 * same filters and walks every page (the server caps a page at 100), so what
 * lands in the sheet is exactly what the filters select — nothing more,
 * nothing less. Because it goes through the same endpoint, it also inherits
 * the same role-gated masking (a BD admin exports the masked phone they see).
 *
 * We only ever WRITE workbooks here. SheetJS's parsing advisories concern
 * reading untrusted files, which this never does.
 */

/** Every row the filters select, across all pages. */
export async function fetchAllRows(fetcher, params, { limit = MAX_LIMIT, maxRows = 50000 } = {}) {
  const all = []
  let offset = 0
  let total = Infinity
  while (offset < total && all.length < maxRows) {
    const page = await fetcher({ ...params, limit, offset })
    total = page.total
    if (page.rows.length === 0) break // defensive: never spin on an empty page
    all.push(...page.rows)
    offset += page.rows.length
  }
  return all
}

/**
 * Builds and downloads a workbook.
 *
 * `columns` is [{ header, value: (row) => cell }]. Cells may be strings,
 * numbers, or null/undefined (written blank). Column widths are sized to the
 * content so nothing opens truncated.
 */
export async function exportToXlsx({ rows, columns, sheetName = 'Sheet1', filename }) {
  const XLSX = await loadXlsx()
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.header, cellValue(c.value(row))])),
  )
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) })
  ws['!cols'] = columns.map((c) => ({
    wch: Math.min(
      48,
      Math.max(c.header.length + 2, ...data.map((d) => String(d[c.header] ?? '').length + 2)),
    ),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)) // Excel's sheet-name limit
  XLSX.writeFile(wb, filename)
}

const cellValue = (v) => (v === null || v === undefined ? '' : v)

/**
 * A template / plain sheet from explicit headers and row objects (keys =
 * headers). Used for the F&B templates the admin fills in and re-uploads.
 */
export async function downloadXlsx({ filename, sheetName = 'Sheet1', headers, rows = [] }) {
  const XLSX = await loadXlsx()
  const data = rows.map((r) => Object.fromEntries(headers.map((h) => [h, cellValue(r[h])])))
  const ws = XLSX.utils.json_to_sheet(data, { header: headers })
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(16, h.length + 4) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

/**
 * Reads the first sheet of an uploaded .xlsx/.csv into row objects keyed by
 * their lowercased, trimmed header. Empty cells come back as ''. Values
 * keep their spreadsheet type (numbers stay numbers); callers coerce.
 */
export async function readXlsxRows(file) {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true }).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), typeof v === 'string' ? v.trim() : v]),
    ),
  )
}

/** "Neon Lights Launch Party!" → "neon-lights-launch-party", for filenames. */
export function slugForFilename(text, fallback = 'all') {
  const slug = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || fallback
}

/** YYYY-MM-DD in IST — the date the admin sees, not the server's. */
export function todayForFilename() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

/**
 * Several sheets in one workbook — the F&B dashboard export (top-ups and
 * bills side by side). `sheets` is [{ name, rows, columns }] with the same
 * column shape as exportToXlsx.
 */
export async function exportWorkbook({ filename, sheets }) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  for (const { name, rows, columns } of sheets) {
    const data = rows.map((row) => Object.fromEntries(columns.map((c) => [c.header, cellValue(c.value(row))])))
    const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) })
    ws['!cols'] = columns.map((c) => ({
      wch: Math.min(48, Math.max(c.header.length + 2, ...data.map((d) => String(d[c.header] ?? '').length + 2))),
    }))
    XLSX.utils.book_append_sheet(wb, ws, String(name).slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}
