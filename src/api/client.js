import axios from 'axios'
import { getToken, logoutFromAnywhere } from '../store/authStore'

const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  // Loud in dev, harmless in prod: every request would otherwise resolve
  // against the app's own origin and 404.
  console.error(
    '[cirkle-admin] VITE_API_URL is not set. Create a .env.local with VITE_API_URL=<backend url>.',
  )
}

export const LOGIN_PATH = '/admin/auth/login'

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    // The backend is served through an ngrok tunnel during development;
    // without this header ngrok returns its HTML interstitial instead of JSON.
    'ngrok-skip-browser-warning': 'true',
  },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''

    // A 401 anywhere but the login call itself means the token is dead
    // (expired, revoked, or the admin was deactivated). Clearing the store
    // flips isAuthenticated and ProtectedRoute sends them to /login.
    //
    // A 401 *on* login is a credential error — the session was never valid,
    // so there is nothing to clear and LoginPage handles the message.
    if (status === 401 && !url.includes(LOGIN_PATH)) {
      logoutFromAnywhere()
    }

    // 403 is deliberately not handled here. The session is fine — this admin
    // just lacks the capability (e.g. a BD admin hitting /admin/admins).
    // Logging them out would be wrong; callers show a permission message.
    return Promise.reject(error)
  },
)

/**
 * True when the request never reached the backend — offline, tunnel down, or
 * blocked by CORS. Callers use this to show "something went wrong" rather than
 * a credential error.
 */
export const isNetworkError = (error) => !error?.response

/** True when the backend refused the action for lack of permission. */
export const isForbidden = (error) => error?.response?.status === 403

export default api
