# AgentHub — Phase 1 任务清单 (MVP)

> 目标: 实现用户注册/登录、实例 CRUD、任务下发、实时日志查看的最小可用产品
> 预估工期: 4-6 周

---

## 模块划分

### A. 认证与租户 (Auth & Tenant)
- [ ] `POST /auth/register` — 用户注册 (email + password)
- [ ] `POST /auth/login` — 登录返回 JWT
- [ ] `GET /auth/me` — 获取当前用户信息
- [ ] `POST /auth/refresh` — Token 刷新
- [ ] 前端: 登录/注册页面
- [ ] 前端: Axios interceptor 自动附加 JWT

### B. 实例管理 (Instance Manager)
- [ ] 后端: `POST /instances` — 异步创建 Hermes 容器 (Celery)
- [ ] 后端: `GET /instances` — 列出用户实例
- [ ] 后端: `POST /instances/{id}/start` — 启动容器
- [ ] 后端: `POST /instances/{id}/stop` — 停止容器
- [ ] 后端: `DELETE /instances/{id}` — 销毁容器及数据卷
- [ ] 后端: `GET /instances/{id}/status` — 容器运行状态
- [ ] 前端: Instances 页面 (创建/启停/删除/状态查看)
- [ ] Docker: `Dockerfile.hermes-base` 构建与优化
- [ ] Docker: 容器健康检查与自动重启
- [ ] 核心: `InstanceManager` 实现 Docker SDK 调用

### C. 任务系统 (Task System)
- [ ] 后端: `POST /tasks` — 创建任务 (project + agents + description)
- [ ] 后端: `GET /tasks` — 任务列表 (分页)
- [ ] 后端: `GET /tasks/{id}` — 任务详情
- [ ] 后端: `POST /tasks/{id}/cancel` — 取消任务
- [ ] 后端: 任务转发到对应 Hermes 容器 HTTP API
- [ ] 后端: WebSocket 实时推送任务日志
- [ ] 前端: Tasks 页面 (创建/列表/详情)
- [ ] 前端: 任务日志实时流 (WebSocket/SSE)

### D. 项目与配置 (Project & Config)
- [ ] 后端: `POST /projects` — 创建项目
- [ ] 后端: `GET /projects` — 项目列表
- [ ] 后端: `PUT /projects/{id}/config` — 更新 models.yaml
- [ ] 后端: 项目级模型覆盖传递给 ModelRouter
- [ ] 前端: Settings 页面 (模型配置编辑器)

### E. 监控与配额 (Monitoring & Quota)
- [ ] 后端: ModelProxy 中间件 (拦截模型 API 调用)
- [ ] 后端: 用量计量 (token 数 / 请求数)
- [ ] 后端: 租户级配额检查 (超额返回 429)
- [ ] 前端: Dashboard 展示 (活跃实例 / 今日任务 / Token 用量)
- [ ] Prometheus: 应用指标暴露
- [ ] Grafana: 基础 Dashboard 配置

### F. 基础设施 (Infra)
- [ ] PostgreSQL: 初始化 + Alembic 首版迁移
- [ ] Redis: Session + 任务队列 + Rate Limit
- [ ] Traefik: 动态路由规则验证
- [ ] Docker Compose: 完整启动链路测试
- [ ] `.env` 配置管理与文档

---

## 设计约束

1. **所有外部 API 调用必须经过 ModelProxy** (计费 + 审计)
2. **租户数据隔离**: PostgreSQL RLS + Docker 容器隔离双层防护
3. **异步操作**: 实例创建/销毁走 Celery，避免 API 超时
4. **容器资源配额**: free/pro/team/enterprise 四级 cgroup 限制

---

## 技术债务 (二期处理)

- [ ] 前端工作流编排器 (ReactFlow)
- [ ] Stripe 计费集成
- [ ] K8s Operator 迁移
- [ ] GPU 集群调度
- [ ] 冷启动 Warm Pool
- [ ] SAML/OIDC 企业 SSO
