# AgentHub 混合架构设计 (Control Plane TS + Data Plane Go)

> **版本**: v1.0 | **状态**: 已批准 | **作者**: CTO Agent
>
> 方向: 控制平面 TypeScript (NestJS)，数据平面 Go (Gin)

---

## 目录

1. [架构图与服务拆分](#1-架构图与服务拆分)
2. [技术选型](#2-技术选型)
3. [通信协议与 API 契约](#3-通信协议与-api-契约)
4. [完整数据流](#4-完整数据流)
5. [项目目录结构](#5-项目目录结构)
6. [部署拓扑与 Docker Compose](#6-部署拓扑与-docker-compose)
7. [关键设计决策](#7-关键设计决策)

---

## 2. 服务拆分

### 控制平面（TypeScript）
| 服务 | 职责 | 为何必须在控制平面 |
|

---

# AgentHub 混合架构 — 通信协议、API 契约与数据流

> Part B：控制平面（TypeScript）与数据平面（Go）之间的通信设计

---

---

# AgentHub 混合架构：目录结构 + 部署拓扑 + Docker Compose

## 1. 项目目录结构

```
agenthub/
├── ts-control-plane/           # TypeScript 控制平面 (NestJS)
│   ├── src/
│   │   ├── main.ts             # 应用入口， bootstrap
│   │   ├── core/               # 基础设施与横切关注点
│   │   │   ├── config/         # 环境配置、配置加载器
│   │   │   ├── database/       # Prisma schema、迁移脚本、连接池封装
│   │   │   ├── redis/          # Redis 模块、缓存服务、发布订阅封装
│   │   │   ├── auth/           # JWT/SSO 守卫、策略、鉴权装饰器
│   │   │   ├── interceptors/   # 日志、响应格式化、超时拦截器
│   │   │   └── exceptions/     # 全局异常过滤器
│   │   ├── modules/            # 业务领域模块
│   │   │   ├── agents/         # Agent CRUD、状态机、生命周期管理
│   │   │   ├── workflows/      # 工作流编排、DAG 定义、版本控制
│   │   │   ├── executions/     # 执行记录、审计日志、重放接口
│   │   │   ├── users/          # 用户、租户、权限 RBAC
│   │   │   ├── integrations/   # 第三方连接器、凭证加密存储
│   │   │   └── events/         # 内部事件总线、WebSocket 网关
│   │   └── shared/             # DTO、枚举、工具函数（纯类型）
│   ├── prisma/
│   │   ├── schema.prisma       # 数据模型（单文件）
│   │   └── migrations/         # 迁移历史
│   ├── test/                   # e2e 测试、集成测试
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── Dockerfile
│
├── go-data-plane/              # Go 数据平面 (高性能运行时)
│   ├── cmd/
│   │   └── dp-server/          # 可执行入口 main.go
│   ├── internal/
│   │   ├── runtime/            # Agent 执行引擎、沙箱调度
│   │   ├── worker/             # 任务队列消费者、goroutine 池
│   │   ├── sandbox/            # 容器/进程隔离、资源限制
│   │   ├── stream/             # 日志流、结果流 gRPC/HTTP 推送
│   │   ├── metrics/            # Prometheus 指标、资源采集
│   │   └── config/             # Viper 配置、环境绑定
│   ├── pkg/
│   │   ├── protocol/           # 与控制平面的 API 契约（IDL 生成）
│   │   ├── security/           # mTLS、Token 校验、 secrets 代理
│   │   └── utils/              # 通用工具（超时、重试、幂等）
│   ├── api/
│   │   └── proto/              # Protobuf / gRPC 定义
│   ├── deployments/
│   │   └── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   └── Makefile
│
├── frontend/                   # React 管理控制台（已有）
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
│
├── docker/
│   ├── docker-compose.yml      # 单机混合编排
│   ├── docker-compose.prod.yml # 生产覆盖文件
│   └── traefik/
│       ├── traefik.yml         # 静态配置
│       └── dynamic/            # 动态路由、中间件
│
├── scripts/
│   ├── init-db.sh              # 首次部署初始化
│   └── migrate.sh              # 双平面数据库版本协调
│
├── docs/
│   ├── architecture/
│   │   ├── 01-overview.md
│   │   ├── 02-control-plane.md
│   │   ├── 03-data-plane.md
│   │   └── 04-hybrid-architecture-part-c.md
│   ├── api/                    # OpenAPI / gRPC doc
│   └── ops/                    # 运维手册、故障排查
│
├── Makefile                    # 根级别统一构建命令
└── README.md
```

**目录职责说明**
- `ts-control-plane/src/core`：不直接包含业务，只承载数据库连接、Redis、认证、日志等横切能力，确保 modules/ 内全是纯业务代码。
- `ts-control-plane/prisma`：单文件 schema 便于审查，迁移脚本与代码同版本管理。
- `go-data-plane/internal`：Go 惯用布局，runtime + worker + sandbox 构成执行三要素；pkg/ 下放置可被外部引用的稳定契约。
- `docker/traefik`：将反向代理配置与业务代码分离，方便运维独立变更路由策略。
- `scripts/`：控制平面与数据平面存在跨库事务风险，用脚本显式编排数据库初始化顺序。

---

## 2. 部署拓扑

### 2.1 单机部署（Docker Compose）
所有服务跑在同一台宿主机上：
- **Traefik**（容器）：监听 80/443，负责入口路由、TLS 终止、速率限制。
- **ts-control-plane**（容器）：暴露 3000，处理 REST API、GraphQL/WebSocket、后台任务调度。
- **go-data-plane**（容器）：暴露 8080 + 9090(gRPC)，处理高并发执行、流式日志、容器生命周期。
- **PostgreSQL**（容器）：主数据库，跑在同一宿主机或外部挂载卷。
- **Redis**（容器）：缓存、会话、Pub/Sub、队列轻量级缓冲。
- **frontend**（容器）：Nginx 托管静态资源，暴露 80。

### 2.2 Traefik 统一路由
Traefik 通过 `labels` 或动态配置文件同时路由两平面：
- 控制平面：`PathPrefix(\`/api\`,\`/graphql\`,\`/ws\`)` → `ts-control-plane:3000`
- 数据平面：`PathPrefix(\`/dp\`,\`/v1/execute\`,\`/v1/stream\`)` → `go-data-plane:8080`
- 前端：`Host(\`hub.example.com\`)` 默认 → `frontend:80`

两平面共享同一域名，通过路径前缀区分，避免跨域并简化 TLS 证书管理。

### 2.3 数据库与缓存策略：共享实例，逻辑隔离
建议 **共享 PostgreSQL 实例**，但使用 **独立 Database（或 Schema）**：
- 控制平面数据库：`agenthub_cp`
- 数据平面数据库：`agenthub_dp`

理由：单机部署时资源有限，独立实例会倍增内存与维护成本；逻辑隔离已足以满足关注点分离。若未来数据平面需要时序特征，可再独立引入 TimescaleDB 而不影响控制平面。

Redis 同样 **共享实例，DB 索引隔离**：
- DB 0：控制平面会话、缓存
- DB 1：数据平面执行队列缓冲、流式状态槽

理由：Redis 是单线程内存服务，多个实例会造成端口与内存碎片。通过 key prefix + DB 索引即可避免冲突。

---

## 3. Docker Compose 编排设计

```yaml
# docker/docker-compose.yml 核心服务节选
services:
  traefik:
    image: traefik:v3.0
    ports: ["80:80", "443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik
    networks: [agenthub]

  ts-control-plane:
    build: ../ts-control-plane
    ports: ["3000"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/agenthub_cp
      - REDIS_URL=redis://redis:6379/0
      - DATA_PLANE_GRPC=go-data-plane:9090
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    networks: [agenthub]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s

  go-data-plane:
    build: ../go-data-plane
    ports: ["8080", "9090"]
    environment:
      - DP_HTTP_ADDR=:8080
      - DP_GRPC_ADDR=:9090
      - DATABASE_URL=postgresql://user:pass@postgres:5432/agenthub_dp
      - REDIS_URL=redis://redis:6379/1
      - CP_API_URL=http://ts-control-plane:3000
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [agenthub]
    # 不需要 privileged；只读挂载 docker.sock 已足够创建/管理同级容器
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/healthz"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s

  postgres:
    image: postgres:16-alpine
    volumes: ["pgdata:/var/lib/postgresql/data"]
    networks: [agenthub]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d agenthub_cp"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    networks: [agenthub]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  agenthub:
    driver: bridge

volumes:
  pgdata:
```

**关键配置说明**
- **ts-control-plane**：不直接暴露宿主机端口，仅通过 Traefik 入口进入；`depends_on` 依赖数据库健康检查，避免启动风暴。
- **go-data-plane**：挂载 `docker.sock`（只读）即可调用 Docker API 创建 Agent 沙箱容器；无需 `privileged` 或 `host` 网络，降低攻击面。
- **同一网络 `agenthub`**：使容器间可通过服务名 DNS 互相发现，无需写死 IP。

---

## 4. 关键决策

### 4.1 为什么不合并到一个仓库？
1. **技术栈异构**：TypeScript（Node.js 事件驱动）与 Go（静态编译、低延迟）构建工具链、CI 镜像、依赖管理完全不同。合并会导致根目录脚本与 CI 极度复杂。
2. **发布节奏解耦**：控制平面迭代频繁（API 变更、前端联动），数据平面追求稳定（执行引擎一旦变更需全量回归）。独立仓库可独立发版、独立回滚。
3. **权限与安全边界**：数据平面涉及宿主机容器管理，仓库独立后 CI secret、镜像签名、部署权限可与控制平面隔离。

### 4.2 为什么 go-data-plane 需要 docker.sock？
数据平面是 Agent 的**执行引擎**，核心职责是在宿主机上按需启动隔离沙箱容器（或 Sidecar）来运行用户代码。通过挂载宿主机的 `/var/run/docker.sock`，数据平面容器内的进程可以调用 Docker API 创建、停止、监控**同级容器**，实现任务级隔离，而无需把数据平面本身设为 `privileged`。

### 4.3 数据平面崩溃，控制平面如何优雅降级？
- **状态缓存与熔断**：控制平面在 Redis 中缓存数据平面健康状态与最新节点负载。当 gRPC/HTTP 探测失败时，触发熔断，停止向该数据平面派发新任务。
- **只读降级**：控制平面的 Agent 配置、工作流定义、历史执行记录存储在自身数据库，数据平面离线不影响这些读操作，用户仍可浏览与编辑。
- **写操作排队**：新建执行请求进入 Redis 延迟队列（DB 1），数据平面恢复后按序消费；控制平面返回 `202 Accepted` + `execution_id`，前端轮询状态，而非直接报错。
- **告警与自愈**：配合 Docker Compose `restart: unless-stopped` 与 healthcheck，数据平面容器崩溃后可在数秒内自动重启，队列中的任务流失最小。

---

*本文档定义了 AgentHub 混合架构的物理组织与部署契约，作为后续 CI/CD 与运维手册的基线。*
