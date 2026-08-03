import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrder } from '../api/oversight'
import useAsync from '../hooks/useAsync'
import { errorMessage } from '../lib/errors'
import { formatDateTime, formatPaise, fullName, shortId, titleCaseOrDash } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import DetailList from '../components/DetailList'
import Badge from '../components/Badge'
import { ORDER_STATUS_TONE } from '../lib/status'
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

export default function OrderDetailPage() {
  const { id } = useParams()
  const fetcher = useCallback(() => getOrder(id), [id])
  const { data: order, loading, error, reload } = useAsync(fetcher)

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
        <Spinner />
        Loading order…
      </p>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 px-6 py-14 text-center">
        <p className="text-sm text-gray-600">{errorMessage(error, "Couldn't load this order.")}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
          <Button variant="secondary" to="/orders">
            Back to orders
          </Button>
        </div>
      </div>
    )
  }

  const b = order.breakdown ?? {}

  return (
    <>
      <PageHeader title={`Order ${shortId(order.id)}`}>
        <Button variant="secondary" to="/orders">
          Back to orders
        </Button>
      </PageHeader>

      <Link to="/orders" className="text-sm text-gray-500 hover:text-gray-900">
        ← Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
        <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'gray'} dot>
          {titleCaseOrDash(order.status)}
        </Badge>
        <span>{formatDateTime(order.createdAt)}</span>
        <span className="font-mono text-xs" title={order.id}>
          {order.id}
        </span>
      </div>

      <div className="mt-6 grid max-w-4xl gap-5 md:grid-cols-2">
        <Card title="Price breakdown">
          <DetailList
            items={[
              { label: 'Base price', value: formatPaise(b.basePricePaise) },
              { label: 'Discount', value: b.discountPaise ? `− ${formatPaise(b.discountPaise)}` : formatPaise(0) },
              { label: 'Subtotal', value: formatPaise(b.subtotalPaise) },
              {
                label: `GST${b.gstPercentage != null ? ` (${b.gstPercentage}%)` : ''}`,
                value: formatPaise(b.gstPaise),
              },
              { label: 'Total charged', value: formatPaise(b.totalPaise), strong: true },
            ]}
          />
          <p className="mt-3 text-xs text-gray-500">
            Frozen at purchase — later edits to the event's price never change this.
          </p>
        </Card>

        <Card title="Payment">
          <DetailList
            items={[
              {
                label: 'Method',
                value: order.paymentMethod
                  ? `${titleCaseOrDash(order.paymentMethod)}${
                      order.paymentMethodDetail ? ` · ${order.paymentMethodDetail}` : ''
                    }`
                  : null,
              },
              {
                label: 'Razorpay order',
                value: order.razorpayOrderId ? (
                  <span className="font-mono text-xs">{order.razorpayOrderId}</span>
                ) : null,
              },
              {
                label: 'Razorpay payment',
                value: order.razorpayPaymentId ? (
                  <span className="font-mono text-xs">{order.razorpayPaymentId}</span>
                ) : null,
              },
              {
                label: 'Coupon',
                value: order.coupon ? (
                  <span>
                    <span className="font-mono text-xs">{order.coupon.code}</span>
                    {order.coupon.discountFlatPaise != null &&
                      ` · ${formatPaise(order.coupon.discountFlatPaise)} off`}
                  </span>
                ) : null,
              },
            ]}
          />
        </Card>

        <Card title="Event">
          <DetailList
            items={[
              {
                label: 'Name',
                value: order.event ? (
                  <Link
                    to={`/events/${order.event.id}`}
                    className="font-medium text-brand hover:text-brand-dark"
                  >
                    {order.event.name}
                  </Link>
                ) : null,
              },
            ]}
          />
        </Card>

        <Card title="Buyer">
          <DetailList
            items={[
              {
                label: 'Name',
                value: order.user ? (
                  <Link
                    to={`/users/${order.user.id}`}
                    className="font-medium text-brand hover:text-brand-dark"
                  >
                    {fullName(order.user.firstName)}
                  </Link>
                ) : null,
              },
              { label: 'Phone', value: <Phone value={order.user?.phone} /> },
            ]}
          />
        </Card>

        <Card title="Ticket">
          {order.ticket ? (
            <DetailList
              items={[
                {
                  label: 'Booking ref',
                  value: (
                    <Link
                      to={`/tickets/${order.ticket.id}`}
                      className="font-mono text-xs font-medium text-brand hover:text-brand-dark"
                    >
                      {order.ticket.bookingRef}
                    </Link>
                  ),
                },
                {
                  label: 'Checked in',
                  value: (
                    <Badge tone={order.ticket.checkedIn ? 'green' : 'gray'} dot>
                      {order.ticket.checkedIn ? 'Checked in' : 'Not checked in'}
                    </Badge>
                  ),
                },
              ]}
            />
          ) : (
            <p className="text-sm text-gray-500">
              No ticket — one is issued only once an order is paid.
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
