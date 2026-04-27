# AgentHub — 用户面板 & 管理员面板 PRD

> **版本**: v0.1 (MVP)  
> **状态**: 草案 / 待评审  
> **日期**: 2026-04-27  
> **项目**: AgentHub — 多租户 AI Agent 管理平台  

---

## 目录

1. [概述](#1-概述)
2. [用户面板 (User Dashboard)](#2-用户面板-user-dashboard)
3. [管理员面板 (Admin Panel)](#3-管理员面板-admin-panel)
4. [用户故事](#4-用户故事)
5. [验收标准](#5-验收标准)
6. [优先级排序 — MVP vs 扩展](#6-优先级排序--mvp-vs-扩展)
7. [路由 & API 端点清单](#7-路由--api-端点清单)
8. [数据库变更](#8-数据库变更)
9. [安全考虑](#9-安全考虑)

---

## 1. 概述

### 1.1 目标

为 AgentHub 提供两个独立的管理界面：

- **用户面板 (User Dashboard)** — 用户登录后看到的默认主页，展示个人资源概览（Token 用量、实例状态、提供商配置）。
- **管理员面板 (Admin Panel)** — 平台管理员视角，查看所有注册用户及其配置，管理全局默认模型提供商。

### 1.2 当前状态

| 模块 | 状态 |
|------|------|
| 认证 (JWT 登录注册) | ✅ 完成 (`POST /auth/register`, `POST /auth/login`) |
| Token 用量追踪 (Redis) | ✅ 完成 (`BillingService`) |
| 租户隔离中间件 | ✅ 完成 (`TenantMiddleware`) |
| 前端骨架页面 | ✅ 空壳 Dashboard / Instances / Tasks / Settings |
| 实例管理 CRUD | ⚠️ 部分完成 |
| 管理员角色 | ❌ 未实现 |
| 全局配置存储 | ❌ 未实现 |
| 管理员 API | ❌ 未实现 |

---

## 2. 用户面板 (User Dashboard)

### 2.1 功能需求

#### FR-U1: 仪表盘概览卡片
- 用户登录后默认路由 `/` (Dashboard)
- 展示四个核心指标卡片：
  - **Token 用量（今日）** — 从 Redis 读取当日 prompt/completion/total tokens
  - **Token 用量（累计）** — 从 Redis 聚合近期数据（当前 7 天 TTL）
  - **可用额度** — 用户 tier (free/pro/enterprise) 对应的配额上限及剩余
  - **活跃实例数** — 当前用户下 `status = "running"` 的实例数量
  - **停止实例数** — 当前用户下 `status = "stopped"` 的实例数量
  - **总任务数 / 进行中任务** — 关联统计

#### FR-U2: 模型提供商状态
- 展示当前可用的 LLM 提供商列表
- MVP 阶段只显示一个默认提供商（从环境变量或全局配置读取）
- 显示：`base_url`、状态（online/offline）、是否默认
- 后续扩展：多提供商切换、自定义提供商标配

#### FR-U3: 个人配置概览
- 显示当前用户的基本信息：邮箱、注册时间、套餐等级 (tier)
- 显示用户的 Project 列表（名称 + 创建时间）
- 快速链接：前往 Instances / Tasks / Settings 页面

#### FR-U4: 用量可视化（可选 MVP+）
- 简单的柱状图或进度条展示 Token 使用率
- 显示配额剩余百分比

### 2.2 数据来源

| 数据 | 来源 | 备注 |
|------|------|------|
| Token 用量 | Redis (BillingService.getUsage) | 当日数据 |
| 用户信息 | Prisma Tenant 表 | JWT 解析 sub 获取 |
| 实例统计 | Prisma Instance 表 (WHERE tenantId) | 聚合查询 |
| 提供商配置 | 环境变量 / 配置表 | MVP 硬编码，后续数据库化 |
| 任务统计 | Prisma Task 表 | 聚合查询 |

---

## 3. 管理员面板 (Admin Panel)

### 3.1 功能需求

#### FR-A1: 管理员认证与角色
- 新增 `role` 字段到 Tenant 模型：`"user" | "admin"`
- 第一个注册用户（或通过 seed 脚本）初始化为 admin
- 管理员专属路由 `/admin/*`，需 `role = "admin"` 才能访问
- 非管理员访问时返回 403 或重定向

#### FR-A2: 用户列表
- 表格展示所有注册用户
- 列：邮箱、名称、套餐等级 (tier)、状态 (active/inactive)、注册时间、实例数
- 支持分页（`/admin/users?page=1&limit=20`）
- 搜索功能（按邮箱/名称模糊匹配）

#### FR-A3: 用户详情
- 点击用户行展开或跳转到详情页 `/admin/users/:id`
- 展示：用户信息和配置
- 展示：该用户的 Token 用量（当日 + 累计）
- 展示：该用户的实例列表（状态、容器名、创建时间）
- 展示：该用户的任务列表
- 操作：禁用/启用用户账号

#### FR-A4: 全局模型提供商配置
- 管理全局默认 LLM 提供商配置
- 字段：`base_url`、`api_key`、`provider_name`（如 openrouter）
- MVP 阶段：存储在环境变量或数据库 `system_config` 表
- 管理员可通过界面查看/编辑 `base_url` 和 `api_key`
- 配置变更后，新创建的项目/实例自动继承

#### FR-A5: 平台概览
- 管理员 Dashboard (`/admin`)
- 展示：总用户数、总实例数、总 Token 消耗（全部用户聚合）
- 展示：最近注册用户列表

### 3.2 数据来源

| 数据 | 来源 | 备注 |
|------|------|------|
| 用户列表 | Prisma Tenant 表 (findMany) | 分页 |
| 用户用量 | Redis (BillingService.getUsage) | 按 tenantId 查 |
| 实例统计 | Prisma Instance 表 | GROUP BY tenantId |
| 全局配置 | SystemConfig 表 或 环境变量 | 新表 |
| 聚合统计 | Prisma aggregate queries | count, sum |

---

## 4. 用户故事

### 4.1 普通用户

**US-1: 首次登录查看仪表盘**
> 作为新注册的用户，我希望登录后看到一个整洁的仪表盘，能立即看到我当天用了多少 Token、还有多少额度、我的 Agent 实例是否在运行，这样我就能快速了解我的账号状态。

**US-2: 了解模型提供商信息**
> 作为用户，我想知道系统默认使用的 AI 模型提供商是什么、API 地址在哪里，这样我如果需要用到模型调用，知道数据是怎么路由的。

**US-3: 导航到实例管理**
> 作为用户，我想从仪表盘一键跳转到实例管理页面，启动/停止我的 Agent 容器。

### 4.2 管理员

**US-4: 查看所有用户**
> 作为平台管理员，我想查看所有注册用户的列表，包括他们的邮箱、套餐等级和注册时间，这样我可以了解平台的用户增长情况。

**US-5: 查看用户详情**
> 作为管理员，我想点击某个用户查看他的详细配置、Token 用量和实例状态，这样我可以排查用户遇到的问题或监控异常用量。

**US-6: 管理全局模型配置**
> 作为管理员，我想在界面上直接修改全局 AI 模型的 base_url 和 api_key，不需要重启服务或修改环境变量，这样运营更灵活。

**US-7: 禁用异常用户**
> 作为管理员，当我发现某个用户有异常行为时，我希望能够一键禁用其账号，使该用户无法再使用平台资源。

**US-8: 查看平台概览**
> 作为管理员，我想进入管理后台首页就能看到总用户数、总实例数和总 Token 消耗量，这样我能快速判断平台整体运行状况。

---

## 5. 验收标准

### 5.1 用户面板

| # | 验收条件 | 优先级 |
|---|---------|--------|
| AC-U1 | 用户登录后自动跳转到 Dashboard 页面 | P0 |
| AC-U2 | Dashboard 显示当日 Token 用量（prompt/completion/total） | P0 |
| AC-U3 | Dashboard 显示配额上限和已用百分比 | P0 |
| AC-U4 | Dashboard 显示运行中/已停止的实例数量 | P0 |
| AC-U5 | Dashboard 显示默认模型提供商的 base_url 和状态 | P0 |
| AC-U6 | Dashboard 显示用户基本信息（邮箱、套餐、注册时间） | P1 |
| AC-U7 | 所有数据通过 API 实时获取，无硬编码占位数据 | P0 |
| AC-U8 | Dashboard 数据在页面加载时自动刷新 | P0 |
| AC-U9 | 移动端自适应布局正常 | P2 |

### 5.2 管理员面板

| # | 验收条件 | 优先级 |
|---|---------|--------|
| AC-A1 | 只有 `role=admin` 的用户才能访问 `/admin` 路由 | P0 |
| AC-A2 | 普通用户访问 `/admin` 返回 403 或被重定向 | P0 |
| AC-A3 | 管理员页面显示所有用户的分页列表 | P0 |
| AC-A4 | 用户列表支持按邮箱搜索 | P1 |
| AC-A5 | 点击用户可查看详情（配置、用量、实例） | P1 |
| AC-A6 | 管理员可在界面中查看全局 base_url 和 api_key | P0 |
| AC-A7 | 管理员可在界面中编辑 base_url 和 api_key，保存后立即生效 | P1 |
| AC-A8 | 管理员可禁用/启用用户 | P1 |
| AC-A9 | 管理员 Dashboard 显示平台级统计数据 | P1 |
| AC-A10 | 所有管理 API 有操作审计日志（可选） | P2 |

### 5.3 通用

| # | 验收条件 | 优先级 |
|---|---------|--------|
| AC-G1 | 前端所有页面无控制台错误 | P0 |
| AC-G2 | 所有 API 响应时间 < 500ms（缓存热数据） | P1 |
| AC-G3 | 数据库 migration 可回滚 | P0 |
| AC-G4 | JWT token 过期后自动跳转到登录页 | P0 |
| AC-G5 | 前后端分离部署，无 CORS 错误 | P0 |

---

## 6. 优先级排序 — MVP vs 扩展

### 6.1 MVP 范围 (Phase 1)

**后端:**

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| Tenant 模型添加 role 字段 + migration | 小 | 无 |
| `GET /auth/me` — 获取当前用户信息 | 小 | 无 |
| `GET /dashboard/stats` — 用户仪表盘数据聚合 | 中 | BillingService |
| `GET /dashboard/provider` — 默认提供商信息 | 小 | 环境变量 |
| 全局配置表 `SystemConfig` — model 配置存储 | 中 | 无 |
| `GET /admin/users` — 用户列表（分页+搜索） | 中 | 角色守卫 |
| `GET /admin/users/:id` — 用户详情 | 中 | 角色守卫 |
| `GET /admin/users/:id/usage` — 用户用量 | 小 | BillingService |
| `PATCH /admin/users/:id/status` — 启用/禁用 | 小 | 角色守卫 |
| `GET /admin/config` — 获取全局配置 | 小 | 角色守卫 |
| `PUT /admin/config` — 更新全局配置 | 小 | 角色守卫 |
| `GET /admin/stats` — 平台统计 | 小 | 聚合查询 |
| 管理员角色守卫 (RolesGuard) | 小 | 无 |
| 前端 API client (axios + zustand store) | 中 | 无 |

**前端:**

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 用户 Dashboard 重写（4 个数据卡片） | 中 | 后端 API |
| 登录/注册页面 | 中 | 后端 auth |
| Axios interceptor + JWT 自动附加 | 小 | 无 |
| 管理员侧边栏 + Layout | 中 | 后端返回 role |
| 管理员用户列表页 | 中 | 后端 API |
| 管理员用户详情页 | 中 | 后端 API |
| 管理员全局配置页 | 中 | 后端 API |
| 管理员 Dashboard (平台概览) | 中 | 后端 API |
| 路由守卫 (ProtectedRoute / AdminRoute) | 小 | 无 |

### 6.2 后续扩展 (Phase 2+)

| 功能 | 说明 |
|------|------|
| 用量图表 (ECharts/Recharts) | 趋势图、日/周/月切换 |
| 多提供商管理 | 添加/删除/切换多个 LLM 提供商 |
| 提供商标价层级 | 不同提供商不同计费标准 |
| 用户自定义 API Key | 用户可覆盖全局配置 |
| 管理员操作日志 | 记录配置修改、用户禁用等操作 |
| 用户权限组 | 除 admin/user 外增加 reviewer 等角色 |
| WebSocket 实时用量推送 | 前端实时更新 Token 数值 |
| 导出报表 | CSV/PDF 导出用量报告 |
| 通知系统 | 用量阈值告警（邮件/站内信） |

---

## 7. 路由 & API 端点清单

### 7.1 前端路由

| 路由 | 面板 | 描述 | 权限 |
|------|------|------|------|
| `/` | 用户 | Dashboard 首页 | 登录用户 |
| `/login` | — | 登录页 | 未登录 |
| `/register` | — | 注册页 | 未登录 |
| `/instances` | 用户 | 实例管理 | 登录用户 |
| `/tasks` | 用户 | 任务列表 | 登录用户 |
| `/settings` | 用户 | 个人设置 | 登录用户 |
| `/admin` | 管理 | 平台概览 | admin |
| `/admin/users` | 管理 | 用户列表 | admin |
| `/admin/users/:id` | 管理 | 用户详情 | admin |
| `/admin/config` | 管理 | 全局配置 | admin |

### 7.2 后端 API 端点

#### 公有 / 用户端点

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| `POST` | `/auth/register` | 用户注册 | 无 |
| `POST` | `/auth/login` | 用户登录，返回 JWT | 无 |
| `GET` | `/auth/me` | 获取当前用户信息（含 role） | JWT |
| `GET` | `/dashboard/stats` | 用户仪表盘聚合数据 | JWT |
| `GET` | `/dashboard/provider` | 默认模型提供商配置 | JWT |

#### 管理端点 (需 `role=admin`)

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| `GET` | `/admin/stats` | 平台概览统计 | JWT + Admin |
| `GET` | `/admin/users` | 用户分页列表 (?page=&limit=&search=) | JWT + Admin |
| `GET` | `/admin/users/:id` | 用户详情 | JWT + Admin |
| `GET` | `/admin/users/:id/usage` | 用户 Token 用量 | JWT + Admin |
| `PATCH` | `/admin/users/:id/status` | 启用/禁用用户 | JWT + Admin |
| `GET` | `/admin/config` | 获取全局配置 | JWT + Admin |
| `PUT` | `/admin/config` | 更新全局配置 | JWT + Admin |

### 7.3 API Response 格式

```typescript
// GET /dashboard/stats 响应
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "tier": "free",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "usage": {
    "daily": { "promptTokens": 1200, "completionTokens": 800, "totalTokens": 2000 },
    "quota": { "limit": 10000, "remaining": 8000, "usagePercent": 20 }
  },
  "instances": { "running": 2, "stopped": 1, "total": 3 },
  "tasks": { "pending": 1, "running": 1, "completed": 10, "total": 12 },
  "provider": {
    "name": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "status": "online"
  }
}

// GET /admin/users 响应
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "tier": "free",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00Z",
      "instanceCount": 2
    }
  ],
  "meta": { "total": 50, "page": 1, "limit": 20, "totalPages": 3 }
}

// GET /admin/stats 响应
{
  "totalUsers": 50,
  "activeUsers": 45,
  "totalInstances": 120,
  "runningInstances": 80,
  "totalTokensConsumed": 500000,
  "recentRegistrations": [
    { "id": "uuid", "email": "...", "createdAt": "..." }
  ]
}

// GET /admin/config 响应
{
  "provider": {
    "name": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "sk-...****"  // 脱敏返回，真实值只在编辑时提交
  }
}
```

---

## 8. 数据库变更

### 8.1 Tenant 模型 — 新增 role 字段

```prisma
model Tenant {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  role      String   @default("user")    // "user" | "admin"  ← 新增
  tier      String   @default("free")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  instances Instance[]
  projects  Project[]
  tasks     Task[]

  @@map("tenants")
}
```

### 8.2 新增 SystemConfig 表

```prisma
model SystemConfig {
  id    String @id @default(uuid())
  key   String @unique    // e.g. "default_provider"
  value Json              // { "name": "openrouter", "baseUrl": "...", "apiKey": "..." }

  @@map("system_config")
}
```

### 8.3 Migration 脚本

```bash
# 新增 role 字段 + SystemConfig 表
npx prisma migrate dev --name add-admin-role-and-system-config

# Seed 脚本：将第一个用户设为 admin，并插入默认 provider 配置
# 见 docs/prd/seed-admin.ts 示例
```

---

## 9. 安全考虑

### 9.1 权限控制

| 层级 | 措施 |
|------|------|
| **路由级** | 前端 AdminRoute 组件检查 role !== "admin" 时重定向 |
| **API 级** | NestJS RolesGuard 结合 JWT payload 中的 role 字段 |
| **数据级** | 租户隔离中间件确保用户只能看到自己的数据 |
| **配置级** | api_key 返回时脱敏（`sk-...****`），仅提交时加密传输 |

### 9.2 JWT Payload 扩展

当前 JWT payload: `{ sub, email }`
扩展为: `{ sub, email, role }`

```typescript
// auth.service.ts - login 方法
const payload = { sub: tenant.id, email: tenant.email, role: tenant.role };
return {
  access_token: this.jwtService.sign(payload),
  user: { id: tenant.id, email: tenant.email, name: tenant.name, role: tenant.role },
};
```

### 9.3 前端状态管理

```typescript
// zustand store
interface AuthState {
  token: string | null;
  user: { id: string; email: string; name?: string; role: 'user' | 'admin' } | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

---

## 附录 A: 实现路径建议

### Step 1: 后端基础设施
1. Prisma schema 变更（role 字段 + SystemConfig 表）
2. 创建 AdminModule（admin controller + service）
3. 实现 RolesGuard
4. 扩展 JWT payload 包含 role
5. 实现 `GET /auth/me`
6. 实现 `GET /dashboard/stats`（聚合 billing + instance + task 数据）

### Step 2: 前端基础设施
1. 创建 `src/lib/api.ts` — axios 实例 + interceptors
2. 创建 `src/store/auth.ts` — zustand auth store
3. 创建 `src/components/ProtectedRoute.tsx` 和 `src/components/AdminRoute.tsx`
4. 创建登录/注册页面
5. 更新 App.tsx 路由配置

### Step 3: 用户 Dashboard 重写
1. 创建 `src/pages/Dashboard.tsx` 数据组件
2. 统计卡片组件 (`StatsCard.tsx`)
3. 模型提供商状态卡片
4. 用户信息卡片

### Step 4: 管理面板
1. 创建 `src/pages/admin/AdminDashboard.tsx`
2. 创建 `src/pages/admin/AdminUsers.tsx` + `AdminUserDetail.tsx`
3. 创建 `src/pages/admin/AdminConfig.tsx`
4. 管理员 Layout（侧边栏 + 路由）
5. 实现所有管理端 API 端点

---

## 附录 B: 前端组件树

```
src/
├── App.tsx                          # 路由配置
├── main.tsx                         # 入口
├── lib/
│   └── api.ts                       # Axios 实例 + interceptors
├── store/
│   ├── auth.ts                      # zustand auth store
│   └── dashboard.ts                 # 仪表盘数据缓存（可选）
├── components/
│   ├── Layout.tsx                   # 用户侧边栏布局（现有改造）
│   ├── ProtectedRoute.tsx           # 登录守卫
│   ├── AdminRoute.tsx               # 管理员守卫
│   ├── StatsCard.tsx                # 通用统计卡片
│   └── UserInfoCard.tsx             # 用户信息卡片
├── pages/
│   ├── Login.tsx                    # 登录页（新建）
│   ├── Register.tsx                 # 注册页（新建）
│   ├── Dashboard.tsx                # 用户仪表盘（重写）
│   ├── Instances.tsx                # 已有
│   ├── Tasks.tsx                    # 已有
│   ├── Settings.tsx                 # 已有
│   └── admin/
│       ├── AdminLayout.tsx          # 管理员侧边栏布局
│       ├── AdminDashboard.tsx       # 平台概览
│       ├── AdminUsers.tsx           # 用户列表
│       ├── AdminUserDetail.tsx      # 用户详情
│       └── AdminConfig.tsx          # 全局配置管理
```
