import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUsers } from '../api/oversight'
import { listCities } from '../api/reference'
import usePaginatedList from '../hooks/usePaginatedList'
import useAsync from '../hooks/useAsync'
import useDebouncedValue from '../hooks/useDebouncedValue'
import { formatDate, fullName, titleCaseOrDash } from '../lib/format'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Field from '../components/Field'
import { Email, Phone } from '../components/Contact'

export default function UsersPage() {
  const navigate = useNavigate()
  const cities = useAsync(listCities, [])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const list = usePaginatedList(listUsers, {
    initialFilters: { search: '' },
    errorLabel: "Couldn't load users.",
  })

  const { setFilter } = list
  useEffect(() => {
    setFilter('search', debouncedSearch.trim())
  }, [debouncedSearch, setFilter])

  const cityLabel = (cityId) =>
    (cities.data ?? []).find((c) => c.id === cityId)?.label ?? cityId ?? '—'

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
    { key: 'phone', header: 'Phone', render: (u) => <Phone value={u.phone} /> },
    { key: 'email', header: 'Email', render: (u) => <Email value={u.email} /> },
    { key: 'tickets', header: 'Tickets', className: 'tabular-nums', render: (u) => u.ticketCount },
    { key: 'orders', header: 'Orders', className: 'tabular-nums', render: (u) => u.orderCount },
    { key: 'joined', header: 'Joined', render: (u) => formatDate(u.createdAt) },
  ]

  return (
    <>
      <PageHeader title="Users" description="Look up anyone on the platform by phone, email or name." />

      <div className="mb-4 max-w-md">
        <Field
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Phone, email, or name"
          hint="Partial matches, case-insensitive."
          autoComplete="off"
        />
      </div>

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
