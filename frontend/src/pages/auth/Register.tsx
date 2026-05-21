import { Link, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { apiFetch, setToken } from '../../lib/api'
import { betterAuthClient } from '../../lib/better-auth-client'

export default function Register() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: { name?: string; email: string; password: string }) {
    setError(null)
    try {
      const signUpResult = await betterAuthClient.signUp.email({
        name: values.name || values.email,
        email: values.email,
        password: values.password,
      })
      if (signUpResult.error) {
        throw new Error(signUpResult.error.message)
      }

      const result = await apiFetch<{ access_token: string }>('/auth/api-token', {
        method: 'POST',
      })
      setToken(result.access_token)
      navigate('/')
    } catch {
      setError('Could not create account')
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f5f5', padding: 24 }}>
      <Card style={{ width: 420 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>Create your AgentHub account</Typography.Title>
            <Typography.Text type="secondary">Your first workspace is created automatically.</Typography.Text>
          </div>
          {error ? <Alert type="error" showIcon title={error} /> : null}
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="name" label="Name">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>Create account</Button>
          </Form>
          <Typography.Text>
            Already registered? <Link to="/login">Sign in</Link>
          </Typography.Text>
        </Space>
      </Card>
    </main>
  )
}
