import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUsers } from '../api/oversight'
import { listCities, listEventCategories } from '../api/reference'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { formatDate, fullName, titleCaseOrDash } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { exportToXlsx, fetchAllRows, slugForFilename, todayForFilename } from '../lib/exportXlsx'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Field from '../components/Field'
import Button from '../components/Button'
import Alert from '../components/Alert'
import FilterBar from '../components/FilterBar'
import Select from '../components/Select'
import { Email, Phone } from '../components/Contact'

export default function UsersPage() {
  const navigate = useNavigate()
  const cities = useAsync(listCities, [])
  const categories = useAsync(listEventCategories, [])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const list = usePaginatedList(listUsers, {
    // cityId = profile city; eventType = a category the user has requested an
    // invitation to (same definition as the "Type of event" column).
    initialFilters: { search: '', cityId: '', eventType: '' },
    errorLabel: "Couldn't load users.",
  })

  const { setFilter } = list
  useEffect(() => {
    setFilter('search', debouncedSearch.trim())
  }, [debouncedSearch, setFilter])

  const cityLabel = (cityId) =>
    (cities.data ?? []).find((c) => c.id === cityId)?.label ?? cityId ?? '—'

  // Indian numbers read better without the country code in a dense table;
  // anything else (the ~1% non-+91 numbers, or a BD-masked value) is left as is.
  const localPhone = (phone) => (typeof phone === 'string' && phone.startsWith('+91') ? phone.slice(3) : phone)

  // The same columns as the table, honouring the current search. Phones and
  // emails arrive already masked for a BD admin, so the sheet never shows
  // more than the screen does.
  const EXPORT_COLUMNS = [
    { header: 'Name', value: (u) => fullName(u.firstName, u.lastName) },
    { header: 'Age', value: (u) => u.age ?? '' },
    { header: 'Gender', value: (u) => titleCaseOrDash(u.gender) },
    { header: 'City', value: (u) => cityLabel(u.cityId) },
    { header: 'Phone', value: (u) => localPhone(u.phone) ?? '' },
    { header: 'Email', value: (u) => u.email ?? '' },
    { header: 'Type of event', value: (u) => (u.requestedEventTypes ?? []).join(', ') },
    { header: 'Tickets', value: (u) => u.ticketCount },
    { header: 'Orders', value: (u) => u.orderCount },
    { header: 'Joined', value: (u) => formatDate(u.createdAt) },
  ]

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      const rows = await fetchAllRows(listUsers, list.filters)
      const filename = [
        'users',
        slugForFilename(list.filters.search, 'all'),
        slugForFilename(list.filters.cityId ? cityLabel(list.filters.cityId) : '', 'all-cities'),
        list.filters.eventType || 'all-types',
        todayForFilename(),
      ].join('_') + '.xlsx'
      await exportToXlsx({ rows, columns: EXPORT_COLUMNS, sheetName: 'Users', filename })
    } catch (err) {
      setExportError(errorMessage(err, "Couldn't export the users."))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-medium text-gray-900',
      render: (u) => fullName(u.firstName, u.lastName),
    },
    { key: 'age', header: 'Age', className: 'tabular-nums', render: (u) => u.age ?? '—' },
    { key: 'gender', header: 'Gender', render: (u) => titleCaseOrDash(u.gender) },
    { key: 'city', header: 'City', render: (u) => cityLabel(u.cityId) },
    { key: 'phone', header: 'Phone', render: (u) => <Phone value={localPhone(u.phone)} /> },
    { key: 'email', header: 'Email', render: (u) => <Email value={u.email} /> },
    {
      key: 'eventTypes',
      header: 'Type of event',
      // The categories of the events this user has requested invitations to,
      // in the order they first asked — "Trips, Meetups". Purchases don't count.
      render: (u) =>
        u.requestedEventTypes?.length ? (
          <span>{u.requestedEventTypes.join(', ')}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    { key: 'tickets', header: 'Tickets', className: 'tabular-nums', render: (u) => u.ticketCount },
    { key: 'orders', header: 'Orders', className: 'tabular-nums', render: (u) => u.orderCount },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.createdAt) },
  ]

  return (
    <>
      <PageHeader title="Users" description="Look up anyone on the platform by phone, email or name.">
        <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={list.loading || list.total === 0}>
          {exporting ? 'Exporting…' : `Export to Excel${list.total ? ` (${list.total})` : ''}`}
        </Button>
      </PageHeader>

      {exportError && (
        <Alert tone="error" className="mb-4" onDismiss={() => setExportError('')}>
          {exportError}
        </Alert>
      )}

      <FilterBar columns={3} showClear={list.hasFilters} onClear={() => { setSearch(''); list.clearFilters() }}>
        <Field
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Phone, email, or name"
          hint="Partial matches, case-insensitive."
          autoComplete="off"
        />
        <Select
          label="City"
          value={list.filters.cityId}
          onChange={(e) => list.setFilter('cityId', e.target.value)}
          options={cities.data ?? []}
          placeholder="All cities"
          disabled={cities.loading}
          hint="The city on the profile."
        />
        <Select
          label="Type of event"
          value={list.filters.eventType}
          onChange={(e) => list.setFilter('eventType', e.target.value)}
          options={categories.data ?? []}
          placeholder="All types"
          disabled={categories.loading}
          hint="Users who requested an event of this type."
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        loadingLabel="Loading users…"
        emptyTitle={
          list.filters.search ? `No users match "${list.filters.search}".` : 'No users yet.'
        }
        emptyHint={list.filters.search ? 'Try a different phone, email or name.' : undefined}
        pagination={{
          page: list.page,
          pageCount: list.pageCount,
          total: list.total,
          limit: list.limit,
          rowCount: list.rows.length,
          onPageChange: list.setPage,
        }}
      />
    </>
  )
}
