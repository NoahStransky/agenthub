import { useEffect, useState } from 'react'
import { Alert, Space, Switch, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiFetch } from '../../lib/api'

interface AdminUser {
  id: string
  email: string
  name?: string
  platformRole: string
  isActive: boolean
  banned: boolean
  createdAt: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadUsers() {
    try {
      const result = await apiFetch<{ users: AdminUser[] }>('/admin/users')
      setUsers(result.users)
      setError(null)
    } catch {
      setError('Could not load users')
    }
  }

  async function toggleUser(user: AdminUser, isActive: boolean) {
    try {
      await apiFetch(`/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      })
      await loadUsers()
    } catch {
      setError('Could not update user status')
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const columns: ColumnsType<AdminUser> = [
    { title: 'Email', dataIndex: 'email' },
    { title: 'Name', dataIndex: 'name', render: (value) => value || '-' },
    { title: 'Platform Role', dataIndex: 'platformRole' },
    { title: 'Active', dataIndex: 'isActive', render: (_, user) => <Switch checked={user.isActive} onChange={(checked) => toggleUser(user, checked)} /> },
    { title: 'Created', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString() },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Users</Typography.Title>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Table rowKey="id" columns={columns} dataSource={users} />
    </Space>
  )
}
