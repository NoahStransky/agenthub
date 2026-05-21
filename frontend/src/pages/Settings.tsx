import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiFetch } from '../lib/api'

interface Provider {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKeyMasked: string
  isDefault: boolean
  tenantId?: string | null
}

export default function Settings() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  async function loadProviders() {
    try {
      setProviders(await apiFetch<Provider[]>('/llm-providers'))
      setError(null)
    } catch {
      setError('Could not load model providers')
    }
  }

  async function addProvider(values: { name: string; provider: string; baseUrl: string; apiKey: string }) {
    try {
      await apiFetch('/llm-providers', {
        method: 'POST',
        body: JSON.stringify({ ...values, isDefault: providers.length === 0 }),
      })
      form.resetFields(['apiKey'])
      await loadProviders()
    } catch {
      setError('Could not save provider')
    }
  }

  async function setDefault(id: string) {
    try {
      await apiFetch(`/llm-providers/${id}/default`, { method: 'PATCH' })
      await loadProviders()
    } catch {
      setError('Could not set default provider')
    }
  }

  useEffect(() => {
    void loadProviders()
  }, [])

  const columns: ColumnsType<Provider> = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Provider', dataIndex: 'provider' },
    { title: 'Base URL', dataIndex: 'baseUrl' },
    { title: 'API Key', dataIndex: 'apiKeyMasked' },
    { title: 'Default', dataIndex: 'isDefault', render: (value) => value ? <Tag color="blue">Default</Tag> : <Tag>Available</Tag> },
    {
      title: 'Actions',
      render: (_, item) => item.tenantId ? <Button size="small" onClick={() => setDefault(item.id)}>Set default</Button> : <Tag>Platform</Tag>,
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Settings</Typography.Title>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Card title="Model Providers">
        <Table rowKey="id" columns={columns} dataSource={providers} pagination={false} />
      </Card>
      <Card title="Add Provider">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1' }}
          onFinish={addProvider}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, type: 'url' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save Provider</Button>
        </Form>
      </Card>
    </Space>
  )
}
