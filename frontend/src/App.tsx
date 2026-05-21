import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState, type ReactElement } from 'react'
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'
import Dashboard from './pages/Dashboard'
import Instances from './pages/Instances'
import Tasks from './pages/Tasks'
import Settings from './pages/Settings'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminTenants from './pages/admin/AdminTenants'
import { apiFetch, getToken } from './lib/api'

function ProtectedRoute({ children }: { children: ReactElement }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: ReactElement }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    apiFetch<{ user: { platformRole: string } }>('/auth/me')
      .then((me) => setAllowed(['admin', 'super_admin'].includes(me.user.platformRole)))
      .catch(() => setAllowed(false))
  }, [])

  if (!getToken()) {
    return <Navigate to="/login" replace />
  }

  if (allowed === null) {
    return null
  }

  return allowed ? children : <Navigate to="/" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="instances" element={<Instances />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tenants" element={<AdminTenants />} />
      </Route>
    </Routes>
  )
}

export default App
