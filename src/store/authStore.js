import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'cirkle-admin-auth'

/** The role with the manage_admins capability. The portal's only role gate. */
export const ADMINISTRATIVE = 'administrative'

/**
 * Session store for the admin.
 *
 * Both the token and the admin object are persisted. There is no /me endpoint
 * to re-fetch from, so the persisted admin is the only source of the role
 * after a refresh — same approach the organizer dashboard takes with its
 * organizer object.
 *
 * The role is *also* encoded in the JWT, which is what the backend actually
 * enforces on. Persisted role drives the UI only; a tampered localStorage
 * reveals nav items but every gated endpoint still 403s.
 */
export const useAuthStore = create()(
  persist(
    (set) => ({
      token: null,
      admin: null, // { id, email, displayName, role }

      login: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ token: state.token, admin: state.admin }),
    },
  ),
)

/** Derived: is there a session? Use inside components so re-renders track it. */
export const useIsAuthenticated = () => useAuthStore((s) => Boolean(s.token))

/** Derived: may this admin manage admin accounts? Gates the Admins section. */
export const useIsAdministrative = () =>
  useAuthStore((s) => s.admin?.role === ADMINISTRATIVE)

/** Non-reactive reads/writes for use outside React (e.g. axios interceptors). */
export const getToken = () => useAuthStore.getState().token
export const logoutFromAnywhere = () => useAuthStore.getState().logout()
