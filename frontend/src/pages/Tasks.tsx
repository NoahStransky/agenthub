import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { apiFetch } from '../lib/api'

interface Task {
  id: string
  title: string
  status: string
  createdAt: string
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  async function loadTasks() {
    try {
      setTasks(await apiFetch<Task[]>('/tasks'))
      setError(null)
    } catch {
      setError('Could not load tasks')
    }
  }

  async function createTask(values: { title: string }) {
    try {
      await apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      form.resetFields()
      await loadTasks()
    } catch {
      setError('Could not create task')
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  const columns: ColumnsType<Task> = [
    { title: 'Title', dataIndex: 'title' },
    { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
    { title: 'Created', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString() },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Tasks</Typography.Title>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      <Form form={form} layout="inline" onFinish={createTask}>
        <Form.Item name="title" rules={[{ required: true }]} style={{ flex: 1 }}>
          <Input placeholder="Task title" />
        </Form.Item>
        <Button type="primary" htmlType="submit">New Task</Button>
      </Form>
      <Table rowKey="id" columns={columns} dataSource={tasks} />
    </Space>
  )
}
