import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

/** The authenticated frame: fixed sidebar on the left, routed content right. */
export default function Layout() {
  return (
    <div className="flex h-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* max-w-7xl rather than 6xl so the wide oversight tables (Events and
            Users both run to 9 columns) fit without horizontal scrolling.
            Forms constrain themselves to max-w-lg/2xl, so nothing sprawls. */}
        <div className="mx-auto w-full max-w-7xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
