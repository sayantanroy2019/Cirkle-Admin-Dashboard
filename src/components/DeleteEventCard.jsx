import Button from './Button'

/**
 * The danger zone at the foot of the event page. The dialog does the
 * explaining and the backend does the deciding; this only opens the door —
 * and sits outside the page's disabled fieldset so it stays reachable.
 */
export default function DeleteEventCard({ onOpen }) {
  return (
    <section className="rounded-xl border border-red-200 p-5">
      <h2 className="text-sm font-semibold text-red-700">Delete event</h2>
      <p className="mt-1 text-sm text-gray-500">
        If nobody has ordered, bought or asked for an invitation, the event is removed for good.
        Otherwise it is cancelled — hidden from attendees and frozen, while its orders, tickets and
        revenue stay in Oversight. You'll see which before anything happens.
      </p>
      <Button variant="danger" className="mt-4" onClick={onOpen}>
        Delete this event…
      </Button>
    </section>
  )
}
