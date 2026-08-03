import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTicket } from '../api/oversight'
import useAsync from '../hooks/useAsync'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatPaise, fullName, shortId } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import DetailList from '../components/DetailList'
import Badge from '../components/Badge'
import { Phone } from '../components/Contact'
import Spinner from '../components/Spinner'

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function TicketDetailPage() {
  const { id } = useParams()
  const fetcher = useCallback(() => getTicket(id), [id])
  const { data: ticket, loading, error, reload } = useAsync(fetcher)

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading ticket…
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{errorMessage(error, "Couldn't load this ticket.")}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
          <Button variant="secondary" to="/tickets">
            Back to tickets
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title={ticket.bookingRef}>
        <Button variant="secondary" to="/tickets">
          Back to tickets
        </Button>
      </PageHeader>

      <Link to="/tickets" className="text-sm text-gray-500 hover:text-gray-900">
        ← Tickets
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <Badge tone={ticket.checkedIn ? 'green' : 'gray'} dot>
          {ticket.checkedIn ? 'Checked in' : 'Not checked in'}
        </Badge>
        <span>Issued {formatDateTime(ticket.createdAt)}</span>
      </div>

      <div className="mt-6 grid max-w-4xl gap-5 md:grid-cols-2">
        <Card title="Ticket">
          <DetailList
            items={[
              {
                label: 'Booking ref',
                value: <span className="font-mono text-xs">{ticket.bookingRef}</span>,
              },
              {
                label: 'Checked in at',
                value: ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : null,
              },
              { label: 'Issued', value: formatDateTime(ticket.createdAt) },
            ]}
          />
        </Card>

        <Card title="Event">
          <DetailList
            items={[
              {
                label: 'Name',
                value: ticket.event ? (
                  <Link
                    to={`/events/${ticket.event.id}`}
                    className="font-medium text-brand hover:text-brand-dark"
                  >
                    {ticket.event.name}
                  </Link>
                ) : null,
              },
              { label: 'Starts', value: formatDateTime(ticket.event?.startsAt) },
            ]}
          />
        </Card>

        <Card title="Holder">
          <DetailList
            items={[
              {
                label: 'Name',
                value: ticket.user ? (
                  <Link
                    to={`/users/${ticket.user.id}`}
                    className="font-medium text-brand hover:text-brand-dark"
                  >
                    {fullName(ticket.user.firstName)}
                  </Link>
                ) : null,
              },
              { label: 'Phone', value: <Phone value={ticket.user?.phone} /> },
            ]}
          />
        </Card>

        <Card title="Order">
          {ticket.order ? (
            <DetailList
              items={[
                {
                  label: 'Order',
                  value: (
                    <Link
                      to={`/orders/${ticket.order.id}`}
                      className="font-mono text-xs font-medium text-brand hover:text-brand-dark"
                      title={ticket.order.id}
                    >
                      {shortId(ticket.order.id)}
                    </Link>
                  ),
                },
                {
                  label: 'Price paid',
                  value: formatPaise(ticket.order.pricePaidPaise),
                  strong: true,
                },
              ]}
            />
          ) : (
            <p className="text-sm text-gray-500">No linked order.</p>
          )}
        </Card>
      </div>
    </>
  )
}
