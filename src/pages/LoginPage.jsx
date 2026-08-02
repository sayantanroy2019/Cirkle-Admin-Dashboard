import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import api, { LOGIN_PATH, isNetworkError } from '../api/client'
import { useAuthStore, useIsAuthenticated } from '../store/authStore'
import { LANDING_PATH } from '../nav'
import Logo from '../components/Logo'
import Spinner from '../components/Spinner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The backend returns a deliberately generic 401 for unknown email, wrong
// password, and deactivated account alike — so the UI says one thing too.
const GENERIC_CREDENTIAL_ERROR = 'Invalid email or password.'
const GENERIC_FAILURE = 'Something went wrong, please try again.'

export default function LoginPage() {
  const isAuthenticated = useIsAuthenticated()
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={LANDING_PATH} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()

    if (!trimmedEmail || !password) {
      setError('Enter your email and password.')
      return
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const { data } = await api.post(LOGIN_PATH, {
        email: trimmedEmail,
        password,
      })

      if (!data?.token || !data?.admin) {
        // A 200 without a token or admin means the response shape changed.
        // Don't half-log-them-in with an undefined token or a missing role.
        throw new Error('Login response did not include a token and admin')
      }

      login(data.token, data.admin)
      navigate(LANDING_PATH, { replace: true })
    } catch (err) {
      if (err.response?.status === 401) {
        setError(GENERIC_CREDENTIAL_ERROR)
      } else {
        if (isNetworkError(err)) {
          // Most likely cause in this setup: the backend's CORS allow-list is
          // missing this portal's origin, or the ngrok tunnel is down. Both
          // are backend-side — nothing to fix here.
          console.error(
            '[cirkle-admin] login request never reached the backend. Check that VITE_API_URL is reachable and that this origin is on the backend CORS allow-list.',
            err,
          )
        }
        setError(GENERIC_FAILURE)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center sm:mb-8">
          <Logo className="text-2xl" />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            Admin log in
          </h1>
          <p className="mt-1 text-sm text-gray-500">Cirkle platform administration.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none disabled:bg-gray-50 sm:text-sm"
                placeholder="you@cirkle.live"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none disabled:bg-gray-50 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? 'Logging in…' : 'Log in'}
            </button>

            <div aria-live="polite" className="min-h-5">
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Admin accounts are created internally. Contact an administrative admin
          for access or password help.
        </p>
      </div>
    </div>
  )
}
