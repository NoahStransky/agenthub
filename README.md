# AgentHub — 多租户 AI Agent 管理平台

> **Phase**: MVP (v0.1.0) | **Status**: 混合架构骨架搭建完成

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
Traefik (反向代理 + 自动路由)
    ↓
Control Plane (NestJS) — 认证 / 租户 / 计费 / 任务编排
    ↓ gRPC
Data Plane (Go) — Docker 编排 / 日志采集 / ModelProxy
    ↓
Docker Host (租户容器)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + Vite + Tailwind CSS + shadcn/ui |
| **控制平面** | NestJS + Prisma + PostgreSQL + Redis + gRPC 客户端 |
| **数据平面** | Go + Gin + gRPC 服务端 + Docker SDK |
| **跨平面通信** | gRPC (HTTP/2 + Protobuf) |
| **部署** | Docker Compose + Traefik |
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

### 1. 克隆与配置

```bash
git clone https://github.com/NoahStransky/agenthub.git
cd agenthub
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET 和 OPENROUTER_API_KEY
```

### 2. 启动基础设施

```bash
cd docker
docker-compose up -d postgres redis traefik
```

### 3. 启动控制平面

```bash
cd ts-control-plane
npm install
npx prisma migrate dev
npm run start:dev
```

### 4. 启动数据平面

```bash
cd go-data-plane
go mod tidy
go run ./cmd/dp-server
```

### 5. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

## Phase 路线图

详见 [TODO.md](./TODO.md)

## License

MIT
