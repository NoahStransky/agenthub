# AgentHub — 多租户 AI Agent 管理平台

> **Phase**: MVP (v0.1.0) | **Status**: Docker MVP 闭环加固中

AgentHub 是一个多租户 **Solo Company AI Agent** 托管平台。在一台服务器上部署后，可为每个用户创建隔离的 Docker 化 Hermes 实例。

**混合架构**: 控制平面 (TypeScript/NestJS) + 数据平面 (Go/Gin)

## 核心公式

```
1 用户 = 1 Docker 容器 = 1 套 Solo Company 框架
```

## 架构概览

```
用户 (Web UI / API)
    ↓
Traefik / Frontend API Client
    ↓
Control Plane (NestJS) — 认证 / 租户 / 计费 / 任务编排
    ↓ HTTP RuntimeProvider (MVP) / gRPC (planned)
Data Plane (Go) — Docker 编排 / 日志采集 / ModelProxy
    ↓
Docker Host (租户容器)
    ↓
Workspace Storage: MinIO locally, S3-compatible object storage on K8s
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + Vite + Ant Design + Better Auth client |
| **控制平面** | NestJS + Prisma + PostgreSQL + Redis + Better Auth bridge |
| **数据平面** | Go + Gin + gRPC 服务端 + Docker SDK |
| **跨平面通信** | HTTP RuntimeProvider for Docker MVP; gRPC/Protobuf reserved |
| **部署** | Docker Compose + Traefik |
| **Workspace 存储** | Local MinIO for Docker MVP; S3-compatible object storage for K8s |
| **监控** | Prometheus + Grafana |

## 项目结构

```
agenthub/
├── ts-control-plane/         # TypeScript 控制平面 (NestJS)
│   ├── src/
│   │   ├── main.ts           # 应用入口
│   │   ├── core/             # 数据库 / Redis / 认证
│   │   └── modules/          # Auth / Tenant / Instance / Task / Billing
│   ├── prisma/schema.prisma  # 数据模型
│   └── package.json
├── go-data-plane/            # Go 数据平面
│   ├── cmd/dp-server/        # 可执行入口
│   ├── internal/
│   │   ├── runtime/          # Docker 实例管理 + ModelProxy
│   │   └── server/           # gRPC + HTTP 双端口服务
│   ├── api/proto/            # Protobuf 定义
│   └── deployments/Dockerfile
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── pages/            # Dashboard / Instances / Tasks / Settings
│   │   └── components/Layout.tsx
│   └── package.json
├── docker/
│   ├── docker-compose.yml    # 全栈混合编排
│   ├── Dockerfile.control-plane
│   ├── Dockerfile.web
│   └── Dockerfile.hermes-base
├── docs/
│   └── architecture/
│       ├── 03-multi-tenant-agenthub.md
│       └── 04-hybrid-architecture.md  # 混合架构完整方案
├── README.md
└── TODO.md                   # Phase 1 任务清单
```

## 快速开始

下面的命令默认从仓库根目录执行。

### 1. 克隆与配置

```bash
git clone https://github.com/NoahStransky/agenthub.git
cd agenthub
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET 和 OPENROUTER_API_KEY
```

### 2. 一键启动本地 Docker MVP

```bash
make dev-up
```

这会构建 `agenthub/hermes-base:latest`，并启动 Postgres、Redis、MinIO、control-plane、data-plane 和 web。

访问：

```text
http://localhost:5173
```

本地端口：

| 服务 | 本地端口 |
|------|----------|
| Web | 5173 |
| Control Plane | 3000 |
| Data Plane HTTP | 8081 |
| Data Plane gRPC | 50051 |
| Postgres | 5433 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

### 3. 本地 Docker Runtime 机制

本地 Docker MVP 使用 Docker-outside-of-Docker：`data-plane` 自己运行在容器里，但通过挂载宿主机 Docker socket 调用宿主 Docker daemon 创建 Hermes sibling container。

```text
data-plane container
  -> /var/run/docker.sock
  -> host Docker daemon
  -> agenthub/hermes-base:latest Hermes container
```

Hermes 容器会加入固定 Docker network `agenthub_local`，这样 data-plane、control-plane、MinIO 和 Hermes 处在同一个本地网络里。这个方案只用于本地/单机 Docker MVP；后续 K8s Runtime 会把 Docker socket 替换成 Kubernetes API，业务层仍然走 RuntimeProvider contract。

## Hermes 配置边界

AgentHub 不管理 Telegram、Slack、GitHub webhook 等 Hermes 内部业务配置。用户创建 Hermes 实例后，在 Instances 页面点击 `Open Hermes` 进入该实例自己的 UI/API，由 Hermes 自己保存和处理这些配置。

AgentHub 只负责：

- 创建、启动、停止、删除 Hermes 实例；
- 给实例提供受 AgentHub 登录保护的 proxy 入口：`/api/instances/{instanceId}/proxy/`；
- 把请求透明转发给对应 Hermes 实例；
- 注入 workspace、runtime、租户上下文等托管层配置；
- 后续在 K8s 中把同一能力映射到 Service + Ingress/Gateway。

Hermes 自己负责：

- Telegram bot token、webhook、allowed chat ids；
- Hermes 自己的插件、agent、workflow 配置；
- 自己的管理 UI/API；
- 把内部配置持久化到 `/workspace`。

## Hermes Workspace 存储策略

Hermes 实例不应该挂载用户提供的宿主机目录。AgentHub 统一给每个实例提供 `/workspace` 抽象：

- 本地 Docker MVP 使用 Compose 里的 MinIO，bucket 为 `agenthub-workspaces`。
- K8s/生产环境使用 S3-compatible object storage，例如 AWS S3、Cloudflare R2 或托管 MinIO。
- workspace object prefix 固定按租户和实例隔离，例如 `tenants/{tenantId}/instances/{instanceId}/workspace/`。
- RuntimeProvider 后续负责把该 prefix 暴露成容器内 `/workspace`，可以用启动/停止同步、sidecar、对象存储挂载层或 SDK。
- 禁止接受用户传入任意 host path；如果需要本地缓存，也必须是 AgentHub 管理的 per-tenant/per-instance 临时缓存，并以 MinIO/S3 为最终存储。

### 4. 分服务开发启动

```bash
cd ts-control-plane
npm install
npx prisma migrate dev
RUNTIME_PROVIDER=docker DATA_PLANE_HTTP_URL=http://127.0.0.1:8080 npm run start:dev
```

### 5. 启动数据平面

```bash
cd go-data-plane
go mod tidy
go run ./cmd/dp-server
```

### 6. 启动前端

```bash
cd frontend
npm install
npm run dev
```

停止本地 Docker MVP：

```bash
make dev-down
```

## Phase 路线图

详见 [TODO.md](./TODO.md)

## License

MIT
