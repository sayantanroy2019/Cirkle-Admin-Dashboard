/**
 * Lockout guards for admin account management.
 *
 * The backend does NOT enforce any of this — `PATCH /admin/admins/:id` will
 * happily deactivate the account making the request, or demote the only
 * administrative admin, leaving nobody able to manage admins again. Verified
 * against the route source on 2026-08-03: there are no self-edit checks.
 *
 * So these are the only thing standing between an admin and locking themselves
 * (or everyone) out. Each returns a human reason string when the action must be
 * blocked, or null when it's allowed.
 */

const activeAdministrativeCount = (admins) =>
  admins.filter((a) => a.role === 'administrative' && a.isActive).length

/** Is this row the admin who is currently logged in? */
export const isSelf = (admin, currentAdmin) =>
  Boolean(admin && currentAdmin && admin.id === currentAdmin.id)

/**
 * Why deactivating `admin` must be blocked, or null.
 * Deactivation takes effect immediately — the backend re-checks is_active on
 * every request, so a self-deactivation ends the current session mid-use.
 */
export const blockDeactivation = (admin, currentAdmin, admins) => {
  if (!admin.isActive) return null // already inactive; this is a reactivation

  if (isSelf(admin, currentAdmin)) {
    return "You can't deactivate your own account — you'd be signed out immediately and unable to sign back in."
  }
  if (admin.role === 'administrative' && activeAdministrativeCount(admins) <= 1) {
    return 'This is the only active administrative admin. Deactivating it would leave nobody able to manage admin accounts.'
  }
  return null
}

/**
 * Why changing `admin`'s role to `nextRole` must be blocked, or null.
 * Only demotion out of `administrative` can cause a lockout.
 */
export const blockRoleChange = (admin, nextRole, currentAdmin, admins) => {
  if (nextRole === admin.role) return null
  if (admin.role !== 'administrative') return null

  if (activeAdministrativeCount(admins) <= 1) {
    return 'This is the only active administrative admin. Changing its role would leave nobody able to manage admin accounts.'
  }
  return null
}

/**
 * A non-blocking heads-up for a role change that is allowed but consequential.
 * Demoting yourself is legal while another administrative admin exists, but it
 * costs you this section the moment it saves.
 */
export const warnRoleChange = (admin, nextRole, currentAdmin) => {
  if (nextRole === admin.role) return null
  if (isSelf(admin, currentAdmin) && nextRole !== 'administrative') {
    return "You're changing your own role. You'll lose access to admin management as soon as this saves, and only another administrative admin can restore it."
  }
  return null
}
