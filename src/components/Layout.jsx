import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

/** The authenticated frame: fixed sidebar on the left, routed content right. */
export default function Layout() {
  return (
    <div className="flex h-full bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
