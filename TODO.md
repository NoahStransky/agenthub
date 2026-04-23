# AgentHub — Phase 1 任务清单 (MVP)

> 目标: 实现用户注册/登录、实例 CRUD、任务下发、实时日志查看的最小可用产品
> 预估工期: 4-6 周
> 架构: 控制平面 (TypeScript/NestJS) + 数据平面 (Go/Gin) + gRPC 通信

---

## 模块划分

### A. 控制平面 — 认证与租户 (Auth & Tenant)
- [ ] `POST /auth/register` — 用户注册 (email + password)
- [ ] `POST /auth/login` — 登录返回 JWT
- [ ] `GET /auth/me` — 获取当前用户信息
- [ ] Prisma 迁移初始化 (tenants / instances / projects / tasks)
- [ ] 前端: 登录/注册页面
- [ ] 前端: Axios interceptor 自动附加 JWT

### B. 控制平面 — 实例管理 (Instance Manager)
- [ ] `POST /instances` — 创建实例 (调用数据平面 gRPC CreateInstance)
- [ ] `GET /instances` — 列出用户实例
- [ ] `POST /instances/:id/start` — 启动容器
- [ ] `POST /instances/:id/stop` — 停止容器
- [ ] `DELETE /instances/:id` — 销毁容器
- [ ] `GET /instances/:id/status` — 容器状态 (轮询或 gRPC 查询)
- [ ] 前端: Instances 页面 (创建/启停/删除/状态)

### C. 数据平面 — Docker 容器编排
- [ ] `CreateInstance` gRPC 实现 (Docker SDK 创建容器)
- [ ] `StartInstance` / `StopInstance` / `DestroyInstance` gRPC 实现
- [ ] `GetInstanceStatus` gRPC 实现
- [ ] 容器资源配额 (free/pro/team/enterprise 四级)
- [ ] Traefik labels 自动路由
- [ ] 容器健康检查

### D. 数据平面 — 日志与事件
- [ ] `StreamLogs` gRPC 双向流实现
- [ ] `SubscribeEvents` gRPC 实现
- [ ] Docker logs API 采集
- [ ] 控制平面 WebSocket 转发到前端

### E. 控制平面 — 任务系统 (Task System)
- [ ] `POST /tasks` — 创建任务 (查 DB 获取容器 endpoint 后 HTTP 下发)
- [ ] `GET /tasks` — 任务列表
- [ ] `GET /tasks/:id` — 任务详情
- [ ] WebSocket 实时推送任务日志
- [ ] 前端: Tasks 页面 (创建/列表/详情/实时日志)

### F. 数据平面 — ModelProxy
- [ ] `ProxyModelRequest` gRPC 实现
- [ ] 劫持 Hermes 容器内 OpenAI SDK 请求
- [ ] Token 用量计量
- [ ] 租户配额检查 (调用控制平面 Billing API)
- [ ] 异步计费事件上报 (Redis Stream / NATS)

### G. 控制平面 — 项目与配置
- [ ] `POST /projects` — 创建项目
- [ ] `GET /projects` — 项目列表
- [ ] `PUT /projects/:id/config` — 更新 models.yaml
- [ ] 前端: Settings 页面 (模型配置编辑器)

### H. 基础设施 (Infra)
- [ ] PostgreSQL: 初始化 agenthub_cp / agenthub_dp 数据库
- [ ] Redis: Session (DB 0) + 执行队列 (DB 1)
- [ ] Traefik: 动态路由验证
- [ ] Docker Compose: 完整启动链路测试
- [ ] `.env` 配置管理

---

## 设计约束

1. **所有外部 API 调用必须经过 ModelProxy** (计费 + 审计)
2. **租户数据隔离**: PostgreSQL 逻辑隔离 + Docker 容器隔离双层防护
3. **跨平面通信**: 控制平面 → 数据平面必须通过 gRPC
4. **异步操作**: 实例创建走 gRPC 同步调用，状态变更走 gRPC 双向流

---

## 技术债务 (二期处理)

- [ ] 前端工作流编排器 (ReactFlow)
- [ ] Stripe 计费集成
- [ ] K8s Operator 迁移
- [ ] GPU 集群调度
- [ ] 冷启动 Warm Pool
- [ ] SAML/OIDC 企业 SSO
