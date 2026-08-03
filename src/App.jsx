import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import OrganizersPage from './pages/OrganizersPage'
import OrganizerCreatePage from './pages/OrganizerCreatePage'
import OrganizerDetailPage from './pages/OrganizerDetailPage'
import EventsPage from './pages/EventsPage'
import EventCreatePage from './pages/EventCreatePage'
import EventDetailPage from './pages/EventDetailPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import RevenuePage from './pages/RevenuePage'
import InvitationsPage from './pages/InvitationsPage'
import UsersPage from './pages/UsersPage'
import UserDetailPage from './pages/UserDetailPage'
import AdminsPage from './pages/AdminsPage'
import NotFoundPage from './pages/NotFoundPage'
import { LANDING_PATH } from './nav'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to={LANDING_PATH} replace />} />
            <Route path="/organizers" element={<OrganizersPage />} />
            {/* /new before /:id so it isn't swallowed as an organizer id. */}
            <Route path="/organizers/new" element={<OrganizerCreatePage />} />
            <Route path="/organizers/:id" element={<OrganizerDetailPage />} />

            <Route path="/events" element={<EventsPage />} />
            {/* /new before /:id so it isn't swallowed as an event id. */}
            <Route path="/events/new" element={<EventCreatePage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />

            {/* Oversight — read-only. */}
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
            <Route path="/invitations" element={<InvitationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />

            {/* The portal's one role gate. Nested inside Layout so a BD admin
                who types the URL still gets the sidebar around the refusal. */}
            <Route element={<RoleRoute />}>
              <Route path="/admins" element={<AdminsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
