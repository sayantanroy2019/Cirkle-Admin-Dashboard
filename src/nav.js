/**
 * The sidebar's sections, in display order.
 *
 * `administrativeOnly` marks the one role-gated item — admin-account
 * management. The same flag drives the nav rendering and the route guard in
 * App.jsx, so the two can't drift apart.
 *
 * `built: false` items render as present-but-inert placeholders, so the shape
 * of the portal is legible before every section exists. Flip the flag and add
 * the route as each section lands.
 */
export const NAV_GROUPS = [
  {
    label: 'Management',
    items: [
      { to: '/organizers', label: 'Organizers', built: true },
      { to: '/events', label: 'Events', built: true },
    ],
  },
  {
    label: 'Oversight',
    items: [
      { to: '/orders', label: 'Orders', built: true },
      { to: '/tickets', label: 'Tickets', built: true },
      { to: '/revenue', label: 'Revenue', built: true },
      { to: '/invitations', label: 'Invitations', built: true },
      { to: '/users', label: 'Users', built: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/admins', label: 'Admins', built: true, administrativeOnly: true },
    ],
  },
]

/** Where an admin lands after login. The first management section. */
export const LANDING_PATH = '/organizers'
