import { Outlet } from 'react-router-dom'
import { useIsAdministrative } from '../store/authStore'
import NotAuthorizedPage from '../pages/NotAuthorizedPage'

/**
 * Gate for routes that need the administrative role — currently only
 * admin-account management (Section 5).
 *
 * Renders "not authorized" rather than redirecting, so a BD admin who lands
 * here from a bookmark or a typed URL gets an explanation instead of a silent
 * bounce. Nests inside ProtectedRoute, so by here there is always a session.
 *
 * The backend enforces the same rule with a 403; this is the UI half.
 */
export default function RoleRoute() {
  const isAdministrative = useIsAdministrative()

  if (!isAdministrative) {
    return <NotAuthorizedPage />
  }

  return <Outlet />
}
