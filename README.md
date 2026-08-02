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

## ⚠️ Backend CORS

The dev server is pinned to **port 5175** (5173 is the consumer app, 5174 the
organizer dashboard). The backend's CORS allow-list must include
`http://localhost:5175`, plus this portal's Vercel domain once deployed —
otherwise every request fails before it leaves the browser and the login screen
shows "Something went wrong, please try again."

That's a backend change, not a frontend one. As of this writing the allow-list
in the backend's `src/app.js` contains 5173, 5174 and the consumer Vercel
domain — **5175 is not yet on it.**

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
  components/           Layout, Sidebar, ProtectedRoute, RoleRoute, Field, …
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
- **The gallery is a full replace, not an append.** `PUT .../gallery` needs an
  `s3Key` and `position` for every photo that should survive, so keeping an
  existing one means echoing its key back. Both `GET /admin/events/:id` and the
  save response carry `s3Key` per item, so `GalleryManager` stages the whole
  set locally and commits it in one call.

## Build progress

- [x] **0** Foundation — API layer, auth store, role-aware routing, sidebar shell
- [x] **1** Login
- [x] **2** Organizers — create / list / edit
- [x] **3** Events — create / list / edit + image upload
- [ ] **4** Oversight — orders, tickets, revenue, invitations, users
- [ ] **5** Admins — create / manage admin accounts (administrative only)

Nav items for unbuilt sections render greyed and inert. As each lands, flip
`built: true` in [`src/nav.js`](src/nav.js) and mount its route in
[`src/App.jsx`](src/App.jsx).

## Deploy

Vercel, GitHub-connected, its own project separate from the other frontends.
Set `VITE_API_URL` in the Vercel project's environment variables.
