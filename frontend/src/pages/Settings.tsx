import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Space, Table, Tag, Typography, message } from 'antd'
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

interface ProviderConnectionResult {
  ok: boolean
  status: number
  latencyMs: number
  provider: string
  baseUrl: string
  modelCount?: number
  message?: string
}

export default function Settings() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [error, setError] = useState<string | null>(null)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [testingDraft, setTestingDraft] = useState(false)
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionResult | null>(null)
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

  async function testDraftProvider() {
    try {
      const values = await form.validateFields()
      setTestingDraft(true)
      const result = await apiFetch<ProviderConnectionResult>('/llm-providers/test', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      setConnectionResult(result)
      if (result.ok) {
        message.success(`Connection ok (${result.latencyMs}ms)`)
      } else {
        message.error(result.message || `Provider returned HTTP ${result.status}`)
      }
    } catch (err) {
      if (err instanceof Error) {
        setError('Could not test provider connection')
      }
    } finally {
      setTestingDraft(false)
    }
  }

  async function testExistingProvider(item: Provider) {
    try {
      setTestingProviderId(item.id)
      const result = await apiFetch<ProviderConnectionResult>(`/llm-providers/${item.id}/test`, { method: 'POST' })
      setConnectionResult(result)
      if (result.ok) {
        message.success(`${item.name} connection ok (${result.latencyMs}ms)`)
      } else {
        message.error(result.message || `${item.name} returned HTTP ${result.status}`)
      }
    } catch {
      setError('Could not test provider connection')
    } finally {
      setTestingProviderId(null)
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
      render: (_, item) => (
        <Space>
          <Button size="small" loading={testingProviderId === item.id} onClick={() => testExistingProvider(item)}>Test</Button>
          {item.tenantId ? (
            <Button size="small" disabled={item.isDefault} onClick={() => setDefault(item.id)}>Set default</Button>
          ) : (
            <Tag>Platform</Tag>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Settings</Typography.Title>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Card title="Model Providers">
        <Table rowKey="id" columns={columns} dataSource={providers} pagination={false} />
      </Card>
      {connectionResult ? (
        <Alert
          type={connectionResult.ok ? 'success' : 'warning'}
          showIcon
          title={connectionResult.ok ? 'Provider connection succeeded' : 'Provider connection failed'}
          description={`${connectionResult.provider} · HTTP ${connectionResult.status} · ${connectionResult.latencyMs}ms${connectionResult.modelCount !== undefined ? ` · ${connectionResult.modelCount} models` : ''}`}
        />
      ) : null}
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
          <Space>
            <Button type="primary" htmlType="submit">Save Provider</Button>
            <Button loading={testingDraft} onClick={testDraftProvider}>Test Connection</Button>
          </Space>
        </Form>
      </Card>
    </Space>
  )
}
