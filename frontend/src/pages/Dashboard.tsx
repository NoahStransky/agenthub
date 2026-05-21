import { useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Space, Statistic, Typography } from 'antd'
import { apiFetch } from '../lib/api'

interface DashboardStats {
  instances: number
  tasks: number
  projects: number
  usage: {
    totalTokens: number
  }
  quota: number
}

interface AuthMe {
  user: {
    email: string
    platformRole: string
  }
  activeTenant: {
    name: string
    tier: string
  } | null
  memberRole: string | null
}

interface ProviderResponse {
  providers?: Array<{ id: string; name: string }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [me, setMe] = useState<AuthMe | null>(null)
  const [provider, setProvider] = useState<string>('Unavailable')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsRes, meRes, providerRes] = await Promise.all([
          apiFetch<DashboardStats>('/dashboard/stats'),
          apiFetch<AuthMe>('/auth/me'),
          apiFetch<ProviderResponse>('/dashboard/provider'),
        ])

        setStats(statsRes)
        setMe(meRes)
        setProvider(providerRes.providers?.[0]?.name ?? 'Unavailable')
      } catch {
        setError('Dashboard data unavailable')
      }
    }

    void loadDashboard()
  }, [])

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>Workspace Dashboard</Typography.Title>
        <Typography.Text type="secondary">
          {me ? `${me.user.email} · ${me.activeTenant?.name ?? 'No workspace'} · ${me.memberRole ?? 'member'} · ${provider}` : 'Loading workspace'}
        </Typography.Text>
      </div>
      {error ? <Alert type="error" title={error} showIcon /> : null}
      {me ? (
        <Alert type="info" showIcon title={`Plan: ${me.activeTenant?.tier ?? 'free'} · Platform role: ${me.user.platformRole}`} />
      ) : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="Instances" value={stats?.instances ?? 0} loading={!stats} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="Tasks" value={stats?.tasks ?? 0} loading={!stats} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="Token Usage" value={stats?.usage.totalTokens ?? 0} loading={!stats} /></Card></Col>
      </Row>
    </Space>
  )
}
