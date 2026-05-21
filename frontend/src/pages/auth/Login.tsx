import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { apiFetch, setToken } from '../../lib/api'
import { betterAuthClient } from '../../lib/better-auth-client'

export default function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: { email: string; password: string }) {
    setError(null)
    try {
      const signInResult = await betterAuthClient.signIn.email({
        email: values.email,
        password: values.password,
      })
      if (signInResult.error) {
        throw new Error(signInResult.error.message)
      }

      const result = await apiFetch<{ access_token: string }>('/auth/api-token', {
        method: 'POST',
      })
      setToken(result.access_token)
      const me = await apiFetch<{ user: { platformRole: string } }>('/auth/me')
      navigate(['admin', 'super_admin'].includes(me.user.platformRole) ? '/admin' : '/')
    } catch {
      setError('Invalid email or password')
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ width: 420 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>Sign in to AgentHub</Typography.Title>
            <Typography.Text type="secondary">One login for workspaces and platform admin.</Typography.Text>
          </div>
          {error ? <Alert type="error" showIcon title={error} /> : null}
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>Sign in</Button>
          </Form>
          <Typography.Text>
            No account? <Link to="/register">Create one</Link>
          </Typography.Text>
        </Space>
      </Card>
    </main>
  )
}
