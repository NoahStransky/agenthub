import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Boxes, ClipboardList, Settings } from 'lucide-react'

const nav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/instances', label: 'Instances', icon: Boxes },
  { path: '/tasks', label: 'Tasks', icon: ClipboardList },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">AgentHub</h1>
        </div>
        <nav className="p-4 space-y-2">
          {nav.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
