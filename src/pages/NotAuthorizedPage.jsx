import { Link } from 'react-router-dom'
import { LANDING_PATH } from '../nav'

/**
 * Shown when a valid session lacks the capability for a route — today that's
 * only a business_development admin reaching admin-account management.
 * Deliberately not a logout: the session is fine.
 */
export default function NotAuthorizedPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">
        Not authorized
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
        Your account doesn't have permission to view this section. If you need
        access, ask an administrative admin.
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
