# AgentHub — 用户面板 & 管理员面板 技术架构设计

> 版本: v0.1 (MVP) | 日期: 2026-04-27

---

## 1. 数据库变更

### 1.1 Tenant 表加 role 字段

```
model Tenant {
  ...
  role      String   @default("user")  // "user" | "admin"
  ...
}
```

### 1.2 新增 SystemConfig 表

```
model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt

  @@map("system_config")
}
```

初始 Seed: key = "llm_provider", value = JSON: `{"base_url": "${DEFAULT_LLM_BASE_URL}", "api_key": "${DEFAULT_LLM_API_KEY}", "provider_name": "openrouter"}`

---

## 2. 后端 API 端点

### 2.1 用户面板 API

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | `/dashboard/stats` | JWT | 用户概览: token用量, 配额, 实例数, 任务数 |
| GET | `/dashboard/usage` | JWT | Token 用量明细 (当日 prompt/completion/total) |
| GET | `/dashboard/provider` | JWT | 当前模型提供商信息 (base_url, 状态) |
| GET | `/me` | JWT | 当前用户个人信息 (email, name, tier, role, createdAt) |
| GET | `/projects` | JWT | (已有) 用户项目列表 |

### 2.2 管理员 API

| Method | Path | Auth | Role | 说明 |
|--------|------|------|------|------|
| GET | `/admin/stats` | JWT | admin | 平台概览: 总用户数, 总实例数, 总Token消耗 |
| GET | `/admin/users` | JWT | admin | 用户列表 (分页, 搜索) |
| GET | `/admin/users/:id` | JWT | admin | 用户详情 |
| PATCH | `/admin/users/:id/status` | JWT | admin | 启用/禁用用户 |
| GET | `/admin/users/:id/usage` | JWT | admin | 指定用户的 Token 用量 |
| GET | `/admin/config` | JWT | admin | 获取全局配置 |
| PUT | `/admin/config` | JWT | admin | 更新全局配置 (base_url, api_key) |

### 2.3 响应格式示例

**GET /dashboard/stats**
```json
{
  "tokenUsage": { "promptTokens": 1500, "completionTokens": 3200, "totalTokens": 4700 },
  "quota": { "tier": "free", "limit": 10000, "used": 4700, "remaining": 5300 },
  "instances": { "running": 1, "stopped": 0, "total": 1 },
  "tasks": { "total": 5, "inProgress": 1 }
}
```

**GET /dashboard/provider**
```json
{
  "baseUrl": "https://api.openrouter.ai/v1",
  "providerName": "openrouter",
  "status": "online",
  "isDefault": true
}
```

**GET /admin/users?page=1&limit=20&search=**
```json
{
  "users": [
    { "id": "...", "email": "user@example.com", "name": "User", "tier": "free",
      "isActive": true, "role": "user", "createdAt": "2026-04-01T00:00:00Z",
      "instanceCount": 2 }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

---

## 3. 前端路由设计

```
/                        → Dashboard (用户面板)
/instances               → Instances (已有)
/tasks                   → Tasks (已有)
/settings                → Settings (已有)
/login                   → LoginPage (新)
/register                → RegisterPage (新)
/admin                   → AdminDashboard (平台概览)
/admin/users             → AdminUserList (用户列表)
/admin/users/:id         → AdminUserDetail (用户详情)
/admin/config            → AdminConfig (全局配置)
```

### 3.1 路由守卫

```
<Routes>
  {/* 公开路由 */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* 认证用户路由 */}
  <Route element={<AuthGuard />}>
    <Route element={<Layout />}>
      <Route index element={<Dashboard />} />
      <Route path="instances" element={<Instances />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Route>

  {/* 管理员路由 */}
  <Route element={<AuthGuard requiredRole="admin" />}>
    <Route path="/admin" element={<AdminLayout />}>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUserList />} />
      <Route path="users/:id" element={<AdminUserDetail />} />
      <Route path="config" element={<AdminConfig />} />
    </Route>
  </Route>
</Routes>
```

---

## 4. 前端组件树

### 4.1 用户面板 (Dashboard)

```
Dashboard
├── DashboardCards
│   ├── TokenUsageCard     — 今日 Token 用量 (进度条)
│   ├── QuotaCard          — 配额使用率
│   ├── InstanceCard       — 实例运行/停止数
│   └── TasksCard          — 任务统计
├── ProviderStatus         — 模型提供商信息
└── ProfileSection         — 个人信息 + Project 列表
```

### 4.2 管理员面板

```
AdminLayout (带管理员侧边栏)
└── Outlet

AdminDashboard
├── PlatformStats
│   ├── TotalUsersCard
│   ├── TotalInstancesCard
│   └── TotalTokenCard
└── RecentUsersList

AdminUserList
├── SearchBar
└── UserTable (分页)

AdminUserDetail
├── UserInfoCard
├── UsageChart
├── InstanceList
└── ActionButtons (禁用/启用)

AdminConfig
├── ConfigForm (base_url, api_key)
└── SaveButton
```

---

## 5. 数据流

### 5.1 Auth Flow

```
Login → POST /auth/login → 返回 JWT token
      → 存入 localStorage
      → zustand authStore 更新
      → axios interceptor 自动附加 Bearer token
      → AuthGuard 检查 token 有效性 + role
```

### 5.2 前端 State 管理 (zustand)

```typescript
// stores/authStore.ts
interface AuthState {
  token: string | null
  user: { id: string; email: string; name?: string; tier: string; role: string } | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: () => boolean
}

// stores/dashboardStore.ts (React Query 替代)
// GET /dashboard/stats → useQuery
// GET /dashboard/provider → useQuery
```

---

## 6. 工作量估算

| 任务 | 文件数 | 预估工时 |
|------|--------|---------|
| Prisma Schema + Migration | 2 | 20min |
| 后端: Dashboard 模块 (stats + usage + provider + me) | 4 | 40min |
| 后端: Admin 模块 (users CRUD + config) | 6 | 60min |
| 后端: AdminGuard | 1 | 10min |
| 前端: Auth pages (Login/Register) | 2 | 30min |
| 前端: AuthGuard + AdminGuard 组件 | 2 | 20min |
| 前端: Dashboard 组件 | 5 | 40min |
| 前端: Admin 组件 | 6 | 50min |
| 前端: Api client + axios interceptor | 2 | 20min |
| 前端: Layout + Routing 调整 | 2 | 15min |
| **总计** | **32** | **~4.5h** |
