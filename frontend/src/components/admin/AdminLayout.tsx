import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChartOutlined, LogoutOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Layout as AntLayout, Menu, Typography } from 'antd'
import { clearToken } from '../../lib/api'
import { betterAuthClient } from '../../lib/better-auth-client'

const { Header, Sider, Content } = AntLayout

const adminNav = [
  { key: '/admin', label: 'Platform Dashboard', icon: <BarChartOutlined /> },
  { key: '/admin/users', label: 'Users', icon: <UserOutlined /> },
  { key: '/admin/tenants', label: 'Tenants', icon: <TeamOutlined /> },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  async function logout() {
    await betterAuthClient.signOut().catch(() => undefined)
    clearToken()
    navigate('/login')
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={260} theme="dark">
        <div style={{ padding: 20 }}>
          <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>AgentHub Admin</Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,.65)' }}>Platform operations</Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={adminNav}
          onClick={(item) => navigate(item.key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button icon={<LogoutOutlined />} onClick={logout}>Logout</Button>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
