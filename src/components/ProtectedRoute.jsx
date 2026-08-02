import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useIsAuthenticated } from '../store/authStore'

/**
 * Gate for every authenticated route. Because it subscribes to the store, a
 * logout triggered from anywhere — including the 401 response interceptor —
 * redirects here on the next render.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
