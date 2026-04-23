# AgentHub — 多租户 AI Agent 管理平台

> **Phase**: MVP (v0.1.0) | **Status**: 骨架搭建完成

AgentHub 是一个多租户 **Solo Company AI Agent** 托管平台。在一台服务器上部署后，可为每个用户创建隔离的 Docker 化 Hermes 实例，让用户通过 Web UI 管理自己的 AI Agent 团队。

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
AgentHub API (FastAPI + PostgreSQL + Redis)
    ↓
Docker 主机 (每个租户一个 Hermes 容器)
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + Vite + Tailwind CSS + shadcn/ui + TanStack Query |
| **后端** | FastAPI + SQLAlchemy 2.0 (async) + Celery + PostgreSQL + Redis |
| **容器** | Docker SDK for Python + Traefik |
| **监控** | Prometheus + Grafana |

## 快速开始

### 1. 克隆与配置

```bash
git clone https://github.com/NoahStransky/agenthub.git
cd agenthub
cp .env.example .env
# 编辑 .env，设置 SECRET_KEY 和 OPENROUTER_API_KEY
```

### 2. 启动基础设施

```bash
cd docker
docker-compose up -d postgres redis traefik
```

### 3. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
agenthub/
├── backend/              # FastAPI 控制平面
│   ├── api/              # REST API Routers
│   ├── core/             # 配置 / 数据库 / 安全 / Docker 管理
│   ├── models/           # SQLAlchemy ORM
│   ├── schemas/          # Pydantic DTO
│   ├── workers/          # Celery 异步任务
│   └── alembic/          # 数据库迁移
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 页面 (Dashboard/Instances/Tasks/Settings)
│   │   ├── hooks/        # 自定义 Hooks
│   │   ├── stores/       # Zustand 状态管理
│   │   └── utils/        # 工具函数
│   └── package.json
├── docker/               # Docker Compose + Dockerfile 模板
│   ├── docker-compose.yml
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── Dockerfile.hermes-base
├── docs/                 # 架构文档
└── scripts/              # 运维脚本
```

## Phase 路线图

详见 [TODO.md](./TODO.md)

## License

MIT
