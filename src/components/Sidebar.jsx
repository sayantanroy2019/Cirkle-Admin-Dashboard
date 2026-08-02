import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useIsAdministrative } from '../store/authStore'
import { LANDING_PATH, NAV_GROUPS } from '../nav'
import Logo from './Logo'

/** administrative → "Administrative", business_development → "Business development" */
const formatRole = (role) => {
  if (!role) return ''
  const spaced = role.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const ITEM_BASE =
  'block rounded-md px-3 py-2 text-sm font-medium transition-colors'

function NavItem({ item }) {
  // Sections that don't exist yet: visible so the shape of the portal is
  // legible, but not clickable and not a dead route.
  if (!item.built) {
    return (
      <span
        className={`${ITEM_BASE} cursor-default text-gray-400 select-none`}
        title="Coming soon"
        aria-disabled="true"
      >
        {item.label}
      </span>
    )
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `${ITEM_BASE} ${
          isActive
            ? 'bg-brand-light text-brand'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {item.label}
    </NavLink>
  )
}

export default function Sidebar() {
  const admin = useAuthStore((s) => s.admin)
  const logout = useAuthStore((s) => s.logout)
  const isAdministrative = useIsAdministrative()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    // The portal's one role gate: a BD admin never sees the Admins item.
    items: group.items.filter((item) => !item.administrativeOnly || isAdministrative),
  })).filter((group) => group.items.length > 0)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50/60">
      <div className="flex h-16 items-center px-5">
        <NavLink to={LANDING_PATH} className="rounded-sm">
          <Logo className="text-lg" />
        </NavLink>
        <span className="ml-2 text-sm font-medium text-gray-400">Admin</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-5 py-4">
        {admin && (
          <div className="mb-3 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900" title={admin.displayName}>
              {admin.displayName}
            </p>
            <p className="truncate text-xs text-gray-500" title={admin.email}>
              {formatRole(admin.role)}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
