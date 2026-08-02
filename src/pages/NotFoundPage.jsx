import { Link } from 'react-router-dom'
import { LANDING_PATH } from '../nav'

export default function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        That page doesn't exist, or hasn't been built yet.
      </p>
      <Link
        to={LANDING_PATH}
        className="mt-6 inline-block text-sm font-medium text-brand hover:text-brand-dark"
      >
        Back to Organizers
      </Link>
    </div>
  )
}
