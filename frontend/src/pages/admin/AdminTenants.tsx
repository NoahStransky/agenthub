import { Empty, Space, Typography } from 'antd'

export default function AdminTenants() {
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={2}>Tenants</Typography.Title>
      <Empty description="Tenant management API is the next admin MVP slice." />
    </Space>
  )
}
