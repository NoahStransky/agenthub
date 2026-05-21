import { useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Space, Statistic, Typography } from 'antd'
import { apiFetch } from '../../lib/api'

interface AdminStats {
  users: { total: number; active: number }
  tenants: { total: number; active: number }
  instances: { total: number; running: number }
  tasks: { total: number; inProgress: number }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<AdminStats>('/admin/stats')
      .then(setStats)
      .catch(() => setError('Could not load platform stats'))
  }, [])

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>Platform Dashboard</Typography.Title>
        <Typography.Text type="secondary">Internal AgentHub operations overview.</Typography.Text>
      </div>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="Users" value={stats?.users.total ?? 0} loading={!stats} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Tenants" value={stats?.tenants.total ?? 0} loading={!stats} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Instances" value={stats?.instances.total ?? 0} loading={!stats} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="Tasks" value={stats?.tasks.total ?? 0} loading={!stats} /></Card></Col>
      </Row>
    </Space>
  )
}
