# Cirkle Admin Portal

The internal portal Cirkle's team uses to run the platform. One of three
frontends against the shared backend (consumer app, organizer dashboard, this).

React + Vite · Tailwind · Zustand · React Router · axios.

## Running it

```bash
npm install
cp .env.example .env.local   # then set VITE_API_URL
npm run dev                  # http://localhost:5175
```

`VITE_API_URL` is the backend's base URL — the ngrok tunnel in dev, or
`http://localhost:3000` when running the backend locally. It is never hardcoded;
the app logs loudly to the console if it's missing.

## Backend CORS

The dev server is pinned to **port 5175** (5173 is the consumer app, 5174 the
organizer dashboard). `http://localhost:5175` is on the backend's CORS
allow-list as of 2026-08-03 — verified end to end in an unflagged browser.

Still outstanding: **this portal's Vercel domain** needs adding to the same list
in the backend's `src/app.js` before the deployed build can reach the API.

## Roles

Admin accounts are `administrative` or `business_development`. The role arrives
in the login response and is encoded in the JWT. There is one login form — the
role is a property of the account, not a choice.

The **only** difference between the roles is admin-account management: an
`administrative` admin sees the Admins section, a `business_development` admin
does not. Everything else is identical for both.

The UI enforces this in two places, both keyed off `administrativeOnly` in
[`src/nav.js`](src/nav.js): the sidebar hides the item, and `RoleRoute` refuses
the route. The backend independently enforces it with a 403, which is the
enforcement that actually matters — the UI half is there so admins don't see
doors they can't open.

## Auth

Token + admin object persist to `localStorage` (`cirkle-admin-auth`). There's no
`/me` endpoint, so the persisted admin is the only source of the role across a
refresh — the same approach the organizer dashboard takes.

Every request carries `Authorization: Bearer <token>` and
`ngrok-skip-browser-warning: true` (without the latter, ngrok returns an HTML
interstitial instead of JSON).

Response handling, in [`src/api/client.js`](src/api/client.js):

- **401** on any call but login → the token is dead. Clear the session; the
  route guard bounces to `/login`.
- **401** on login itself → a credential error. The session was never valid, so
  nothing is cleared and the form shows a generic message.
- **403** → the session is fine, this admin just lacks the capability. Never
  logs out; propagates to the caller to show a permission message.
- **No response at all** (`isNetworkError`) → offline, tunnel down, or CORS.
  Shown as "something went wrong", distinct from a credential error.

## Layout

```
src/
  api/client.js         axios instance, interceptors, error helpers
  api/organizers.js     organizer endpoints; envelope unwrapping
  store/authStore.js    zustand + persist; token, admin, role helpers
  nav.js                sidebar sections; single source of the role gate
  lib/                  errorMessage(), date formatting
  api/oversight.js      the five read-only endpoints; pagination envelope
  components/           Layout, Sidebar, DataTable, Pagination, Contact, …
  hooks/                usePaginatedList, useAsync, useEventOptions, useDebouncedValue
  pages/                LoginPage, Organizer{s,Create,Detail}Page, AdminsPage, …
```

## Where the API differs from the written spec

Confirmed against the live backend on 2026-08-01. The organizer endpoints
deviate from what the section spec described, and the code follows the live API:

- **Responses are enveloped** — `{ organizers: [...] }` and `{ organizer: {...} }`,
  not bare objects. Unwrapped in `api/organizers.js` only.
- **The list is not paginated.** It takes no `limit`/`offset` (they're ignored)
  and returns no `{ total, limit, offset }`. `OrganizersPage` therefore pages
  client-side, and only shows controls past one page.
- **No `updatedAt`** is returned anywhere, so detail doesn't show one.
- **PATCH omits `eventCount`** from its response — callers merge into the
  organizer they hold instead of replacing it, or the count vanishes on save.
- **PATCH also returns 409** on a duplicate email, not just POST.
- **PATCH with no fields returns 400**, so the detail form sends only changed
  fields and short-circuits when nothing changed.

For events (confirmed against Swagger and live responses on 2026-08-02):

- **`price` is in paise.** ₹500 is `50000`. Forms take rupees and convert at
  the boundary — every conversion lives in `lib/format.js`.
- **No ticket-sold count exists** on `/admin/events*`, so the list can't show
  one. Nothing else provides a per-event count either.
- **No pagination**, but there *are* server-side filters: `organizerId`,
  `cityId`, `status=upcoming|past`.
- **PATCH returns the base projection** — `bannerUrl` but no `gallery` and no
  `organizer`, both of which detail returns. Merged, never replaced.
- **`organizerId` is nullable.** The section spec called the organizer
  required; Swagger explicitly allows creating an event unassigned and linking
  it later, so the dropdown offers "Unassigned" rather than blocking.
- **The three social requirement flags** (`requireFacebook`, `requireInstagram`,
  `requireLinkedin` — note the lowercase "i") ride along with the normal event
  create/edit payload. Booleans, default false, and not retroactive: the backend
  evaluates them at purchase time, so switching one on never invalidates tickets
  already sold.
- **The lineup is an upsert by id, not a full replace.** `PUT .../artists`
  updates an artist in place when its `id` is included, creates one when it's
  omitted, and deletes any existing artist whose id is absent. Since photos are
  keyed to the artist id, dropping the id on save recreates the row and orphans
  its photo — verified. `LineupManager` always sends the ids back.
- **Artist photos need a saved artist.** The photo endpoints are keyed to the
  artist id, so a newly added row can't take a photo until the lineup is saved.
  The UI disables that control and says why.
- **Instagram handles are normalized server-side** — a URL, an `@handle` or a
  bare handle all store bare, empty clears, and anything implausible is a 400.
  `lib/instagram.js` mirrors this client-side so the field visibly settles to
  the bare handle; the server stays the authority.
- **The gallery is a full replace, not an append.** `PUT .../gallery` needs an
  `s3Key` and `position` for every photo that should survive, so keeping an
  existing one means echoing its key back. Both `GET /admin/events/:id` and the
  save response carry `s3Key` per item, so `GalleryManager` stages the whole
  set locally and commits it in one call.

For admin accounts (confirmed 2026-08-03):

- **There is no password reset.** `PATCH /admin/admins/:id` reads only
  `displayName`, `role` and `isActive` — a `password` in the body is ignored,
  and a body containing only a password returns 400 "No fields to update".
  The portal says so plainly instead of offering a control that does nothing.
- **Email can't be changed** after creation; it's only set on POST.
- **There is no `GET /admin/admins/:id`**, so the edit screen sources its record
  from the list.
- **No lockout protection server-side.** The API will happily deactivate the
  caller's own account or demote the last administrative admin. Those guards
  live only in [`src/lib/adminGuards.js`](src/lib/adminGuards.js) — don't remove
  them assuming the backend covers it.

For the oversight endpoints (confirmed 2026-08-03):

Unlike the organizer/event endpoints, these **are** properly paginated:
`{ data, total, limit, offset }`, `limit` defaults to 50 and is clamped to 100
server-side. `usePaginatedList` drives every table; `DataTable` renders it.

One trap worth knowing: `GET /admin/orders` compares `from`/`to` **directly
against `created_at`**, so a bare `to=2026-07-28` means midnight and a
single-day range returns nothing. `dayRangeToInstants` widens the admin's chosen
calendar days into the UTC instants that actually bracket them.

Phone and email render only through `components/Contact.jsx`, mirroring the
backend's serializer discipline — when a `view_pii` capability lands, masking is
a one-file change here rather than a dozen table cells.

## Build progress

- [x] **0** Foundation — API layer, auth store, role-aware routing, sidebar shell
- [x] **1** Login
- [x] **2** Organizers — create / list / edit
- [x] **3** Events — create / list / edit + image upload
- [x] **4** Oversight — orders, tickets, revenue, invitations, users
- [x] **5** Admins — create / manage admin accounts (administrative only)

All five sections are built. `src/nav.js` still carries the `built` flag, so a
future section can be added the same way: flip `built: true` and mount its route
in [`src/App.jsx`](src/App.jsx).

## Deploy

Vercel, GitHub-connected, its own project separate from the other frontends.
Set `VITE_API_URL` in the Vercel project's environment variables.
