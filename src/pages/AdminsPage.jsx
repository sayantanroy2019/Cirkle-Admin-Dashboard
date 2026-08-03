import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listAdmins, ROLE_LABELS } from '../api/admins'
import { useAuthStore } from '../store/authStore'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import Alert from '../components/Alert'

export default function AdminsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentAdmin = useAuthStore((s) => s.admin)

  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(location.state?.flash ?? '')

  useEffect(() => {
    if (location.state?.flash) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAdmins(await listAdmins())
    } catch (err) {
      setError(errorMessage(err, "Couldn't load admin accounts."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const columns = [
    {
      key: 'name',
      header: 'Name',
      className: 'font-medium text-gray-900',
      render: (a) => (
        <span>
          {a.displayName}
          {a.id === currentAdmin?.id && (
            <span className="ml-2 text-xs font-normal text-gray-400">You</span>
          )}
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (a) => a.email },
    {
      key: 'role',
      header: 'Role',
      render: (a) => (
        <Badge tone={a.role === 'administrative' ? 'purple' : 'gray'}>
          {ROLE_LABELS[a.role] ?? a.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <Badge tone={a.isActive ? 'green' : 'gray'} dot>
          {a.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { key: 'created', header: 'Created', render: (a) => formatDate(a.createdAt) },
  ]

  return (
    <>
      <PageHeader
        title="Admins"
        description="Cirkle team accounts. Only administrative admins can see or change these."
      >
        <Button to="/admins/new">Create admin</Button>
      </PageHeader>

      {flash && (
        <Alert className="mb-4" tone="success" onDismiss={() => setFlash('')}>
          {flash}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={admins}
        loading={loading}
        error={error}
        onRetry={load}
        onRowClick={(a) => navigate(`/admins/${a.id}`)}
        loadingLabel="Loading admins…"
        emptyTitle="No admin accounts."
        emptyHint="Create one to get started."
        emptyAction={<Button to="/admins/new">Create admin</Button>}
      />
    </>
  )
}
