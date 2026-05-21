import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppstoreOutlined, DashboardOutlined, LogoutOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Button, Layout as AntLayout, Menu, Typography } from 'antd'
import { clearToken } from '../lib/api'
import { betterAuthClient } from '../lib/better-auth-client'

const { Header, Sider, Content } = AntLayout

const workspaceNav = [
  { key: '/', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/instances', label: 'Instances', icon: <AppstoreOutlined /> },
  { key: '/tasks', label: 'Tasks', icon: <UnorderedListOutlined /> },
  { key: '/settings', label: 'Settings', icon: <SettingOutlined /> },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  async function logout() {
    await betterAuthClient.signOut().catch(() => undefined)
    clearToken()
    navigate('/login')
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="light">
        <div style={{ padding: 20, borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>AgentHub</Typography.Title>
          <Typography.Text type="secondary">Workspace</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={workspaceNav}
          onClick={(item) => navigate(item.key)}
          style={{ borderRight: 0, paddingTop: 12 }}
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
