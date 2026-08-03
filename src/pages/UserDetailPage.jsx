import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUser } from '../api/oversight'
import { listCities } from '../api/reference'
import useAsync from '../hooks/useAsync'
import { errorMessage } from '../lib/errors'
import {
  formatDate,
  formatDateTime,
  formatPaise,
  fullName,
  shortId,
  titleCaseOrDash,
} from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import DetailList from '../components/DetailList'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import { ORDER_STATUS_TONE } from '../lib/status'
import { Email, Phone } from '../components/Contact'
import RemoteImage from '../components/RemoteImage'
import Spinner from '../components/Spinner'

function Card({ title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function UserDetailPage() {
  const { id } = useParams()
  const fetcher = useCallback(() => getUser(id), [id])
  const { data: user, loading, error, reload } = useAsync(fetcher)
  const cities = useAsync(listCities, [])

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading user…
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{errorMessage(error, "Couldn't load this user.")}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
          <Button variant="secondary" to="/users">
            Back to users
          </Button>
        </div>
      </div>
    )
  }

  const cityLabel =
    (cities.data ?? []).find((c) => c.id === user.cityId)?.label ?? user.cityId ?? null

  const orderColumns = [
    {
      key: 'id',
      header: 'Order',
      render: (o) => (
        <Link
          to={`/orders/${o.id}`}
          className="font-mono text-xs font-medium text-brand hover:text-brand-dark"
          title={o.id}
        >
          {shortId(o.id)}
        </Link>
      ),
    },
    { key: 'event', header: 'Event', render: (o) => o.eventName ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (o) => (
        <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'gray'} dot>
          {titleCaseOrDash(o.status)}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'tabular-nums',
      render: (o) => formatPaise(o.totalPaise),
    },
    { key: 'created', header: 'Placed', render: (o) => formatDateTime(o.createdAt) },
  ]

  const ticketColumns = [
    {
      key: 'ref',
      header: 'Booking ref',
      render: (t) => (
        <Link
          to={`/tickets/${t.id}`}
          className="font-mono text-xs font-medium text-brand hover:text-brand-dark"
        >
          {t.bookingRef}
        </Link>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (t) => (
        <span>
          {t.eventName ?? '—'}
          {t.eventStartsAt && (
            <span className="block text-xs text-gray-500">{formatDateTime(t.eventStartsAt)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'checkedIn',
      header: 'Check-in',
      render: (t) => (
        <Badge tone={t.checkedIn ? 'green' : 'gray'} dot>
          {t.checkedIn ? 'Checked in' : 'Not checked in'}
        </Badge>
      ),
    },
    { key: 'created', header: 'Issued', render: (t) => formatDateTime(t.createdAt) },
  ]

  return (
    <>
      <PageHeader title={fullName(user.firstName, user.lastName)}>
        <Button variant="secondary" to="/users">
          Back to users
        </Button>
      </PageHeader>

      <Link to="/users" className="text-sm text-gray-500 hover:text-gray-900">
        ← Users
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        {user.age != null && <span>{user.age}</span>}
        {user.gender && <span>{titleCaseOrDash(user.gender)}</span>}
        {cityLabel && <span>{cityLabel}</span>}
        <span>Joined {formatDate(user.createdAt)}</span>
      </div>

      {user.tagline && <p className="mt-3 text-sm text-gray-900">{user.tagline}</p>}

      <div className="mt-6 space-y-5">
        <div className="grid max-w-4xl gap-5 md:grid-cols-2">
          <Card title="Contact">
            <DetailList
              items={[
                { label: 'Phone', value: <Phone value={user.phone} /> },
                { label: 'Email', value: <Email value={user.email} /> },
              ]}
            />
          </Card>

          <Card title="Profile">
            <DetailList
              items={[
                { label: 'Age', value: user.age ?? null },
                { label: 'Gender', value: user.gender ? titleCaseOrDash(user.gender) : null },
                { label: 'City', value: cityLabel },
              ]}
            />
            {user.bio && <p className="mt-3 text-sm text-gray-600">{user.bio}</p>}
          </Card>
        </div>

        {user.photos?.length > 0 && (
          <Card
            title="Photos"
            description="Presigned URLs, valid about an hour — reload the page for fresh ones."
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {user.photos.map((p, i) => (
                <div
                  key={p.id ?? i}
                  className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                >
                  <RemoteImage
                    src={p.url}
                    alt={`Profile photo ${i + 1}`}
                    className="size-full object-cover"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {user.lifestyleTags?.length > 0 && (
          <Card title="Lifestyle tags">
            <div className="flex flex-wrap gap-2">
              {user.lifestyleTags.map((t) => (
                <Badge key={t.id} tone="purple">
                  {t.label}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold tracking-tight text-gray-900">
            Orders{user.orders?.length ? ` (${user.orders.length})` : ''}
          </h2>
          <DataTable
            columns={orderColumns}
            rows={user.orders ?? []}
            loading={false}
            emptyTitle="No orders yet."
          />
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold tracking-tight text-gray-900">
            Tickets{user.tickets?.length ? ` (${user.tickets.length})` : ''}
          </h2>
          <DataTable
            columns={ticketColumns}
            rows={user.tickets ?? []}
            loading={false}
            emptyTitle="No tickets yet."
          />
        </div>
      </div>
    </>
  )
}
