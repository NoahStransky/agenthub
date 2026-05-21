import { useEffect, useState } from 'react'
import { Alert, Button, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiFetch } from '../lib/api'

interface Instance {
  id: string
  containerName: string
  desiredStatus?: string
  observedStatus?: string
  health?: string
  runtimeClass?: string
  createdAt: string
}

export default function Instances() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadInstances() {
    setLoading(true)
    try {
      setInstances(await apiFetch<Instance[]>('/instances'))
      setError(null)
    } catch {
      setError('Could not load instances')
    } finally {
      setLoading(false)
    }
  }

  async function createInstance() {
    try {
      await apiFetch('/instances', {
        method: 'POST',
        body: JSON.stringify({ name: 'Default Hermes', runtimeClass: 'runc' }),
      })
      await loadInstances()
    } catch {
      setError('Could not create instance')
    }
  }

  async function lifecycle(id: string, action: 'start' | 'stop' | 'delete') {
    try {
      await apiFetch(`/instances/${id}${action === 'delete' ? '' : `/${action}`}`, {
        method: action === 'delete' ? 'DELETE' : 'POST',
      })
      await loadInstances()
    } catch {
      setError(`Could not ${action} instance`)
    }
  }

  useEffect(() => {
    void loadInstances()
  }, [])

  const columns: ColumnsType<Instance> = [
    { title: 'Name', dataIndex: 'containerName' },
    { title: 'Desired', dataIndex: 'desiredStatus', render: (value) => <Tag>{value ?? 'running'}</Tag> },
    { title: 'Observed', dataIndex: 'observedStatus', render: (value) => <Tag color={value === 'running' ? 'green' : undefined}>{value ?? 'pending'}</Tag> },
    { title: 'Health', dataIndex: 'health', render: (value) => <Tag color={value === 'healthy' ? 'green' : undefined}>{value ?? 'unknown'}</Tag> },
    { title: 'Runtime', dataIndex: 'runtimeClass', render: (value) => value ?? 'runc' },
    { title: 'Created', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString() },
    {
      title: 'Actions',
      render: (_, instance) => (
        <Space>
          <Button size="small" onClick={() => lifecycle(instance.id, 'start')}>Start</Button>
          <Button size="small" onClick={() => lifecycle(instance.id, 'stop')}>Stop</Button>
          <Button size="small" danger onClick={() => lifecycle(instance.id, 'delete')}>Delete</Button>
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={2} style={{ margin: 0 }}>Instances</Typography.Title>
        <Button type="primary" onClick={createInstance}>Create Instance</Button>
      </div>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Table rowKey="id" columns={columns} dataSource={instances} loading={loading} />
    </Space>
  )
}
