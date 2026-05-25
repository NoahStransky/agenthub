# AgentHub Runtime/K8s Evolution Plan with TDD

## Summary

AgentHub will first become a reliable single-node Docker MVP, while keeping its
data model, runtime interfaces, scheduler flow, ModelProxy, and tests ready for a
future Kubernetes runtime.

The target runtime path is:

1. Phase 0: fix foundational links with real tenant context, runtime contracts,
   and migration-friendly instance state.
2. Phase 1: ship the Docker MVP with auth, tenant-scoped instances, tasks,
   ModelProxy, tenant LLM providers, billing, dashboard, and admin APIs.
3. Phase 2: add production beta mechanics: queue, scheduler, reconciler,
   logs, monitoring, and stronger container isolation.
4. Phase 3: add a Kubernetes runtime with tenant namespaces, network policy,
   resource quota, limit ranges, pod security, RuntimeClass, and watch-based
   reconciliation.

## Architecture Decisions

- Tenant identity comes from JWT `sub`. Tenant-scoped APIs must not trust
  `tenantId` from request bodies or query strings.
- Instances use desired/observed state: `desiredStatus`, `observedStatus`, and
  `health`. This prepares the system for async scheduling and K8s reconciliation.
- Control plane code talks to a runtime contract, not directly to Docker or K8s.
  The initial runtime is Docker; the future runtime is Kubernetes.
- Instance creation, deletion, and task execution should become queued work.
  HTTP requests should create desired state and return quickly.
- Hermes instances do not receive real LLM provider API keys. ModelProxy owns
  provider routing, secret lookup, usage accounting, auditing, and quota checks.
- LLM provider resolution order is task/project provider, tenant default
  provider, then AgentHub platform default provider.
- Hermes instances should not mount arbitrary host paths. Each instance sees a
  stable `/workspace` contract, while AgentHub controls the backing storage.
  Local Docker development uses MinIO as the S3-compatible workspace store; K8s
  production uses S3-compatible object storage such as AWS S3, R2, or MinIO
  Gateway. Runtime providers may implement this as sync-on-start/sync-on-finish,
  an object-storage mount layer, or a sidecar, but the container contract stays
  `/workspace`.
- Kubernetes beta uses one namespace per tenant by default. Each tenant namespace
  receives ResourceQuota, LimitRange, NetworkPolicy, and restricted PodSecurity.
- Authentication should move to Better Auth. Use Better Auth Admin plugin for
  platform/internal roles and Organization plugin for tenant membership roles.
- Keep a single login surface at `/login`; do not create a separate
  `/admin/login`. Route access after login is based on platform role and active
  organization membership.
- Separate the user tenant dashboard from the platform internal admin dashboard:
  `/` is the user's active organization workspace, while `/admin` is the
  AgentHub operator console.

## Better Auth and Dashboard Separation

Target auth model:

- `User` is the login identity and owns platform-level state such as email,
  banned/active status, and `platformRole`.
- `Organization` or `Tenant` is the customer workspace that owns instances,
  tasks, projects, providers, usage, and billing.
- `Member` connects users to organizations with organization-level roles:
  `owner`, `admin`, or `member`.
- Platform roles are separate from organization roles:
  `user`, `admin`, and `super_admin` belong to the platform user; `owner`,
  `admin`, and `member` belong to organization membership.
- Better Auth Admin plugin should guard platform/internal operations such as
  user management, tenant management, platform provider configuration, and
  platform-wide stats.
- Better Auth Organization plugin should guard tenant-scoped operations such as
  instance lifecycle, task creation, project settings, tenant LLM providers, and
  tenant billing views.

Frontend route split:

- `/login`: shared login entry for all users and platform staff.
- `/register`: normal user signup.
- `/`: user dashboard for the active organization.
- `/instances`, `/tasks`, `/settings`, `/providers`: tenant workspace routes.
- `/admin`: platform internal dashboard for AgentHub operators.
- `/admin/users`, `/admin/tenants`, `/admin/instances`, `/admin/providers`,
  `/admin/billing`: platform operations routes.

Migration notes:

- The current MVP uses Better Auth for frontend sign-in/sign-up session cookies,
  while keeping a short-lived NestJS JWT bridge for existing tenant-scoped API
  guards.
- `User`, `Tenant`, `Member`, and `Invitation` are split in the database.
  Better Auth Admin plugin maps its platform role field onto
  `User.platformRole`; Organization plugin maps organizations to `Tenant` and
  members to `Member`.
- `POST /auth/api-token` exchanges a valid Better Auth session for the
  temporary internal API JWT. The JWT uses `sub=userId`; tenant context comes
  from `activeTenantId` and is validated against `Member`.
- The next auth refactor should remove the internal JWT bridge and have all
  tenant-scoped guards read Better Auth session plus active organization
  directly.

## Runtime and Kubernetes Plan

Docker MVP:

- Run one Hermes container per instance.
- Apply CPU, memory, PID, network, non-root, no-privileged, and capability-drop
  constraints before exposing the MVP to real tenants.
- Keep Docker operations behind a runtime provider boundary.
- Local compose uses Docker-outside-of-Docker: the Go data-plane runs in a
  container and talks to the host Docker daemon through `/var/run/docker.sock`.
  Hermes instances are sibling containers on the host Docker daemon, not nested
  Docker-in-Docker children.
- Data-plane-created Hermes containers must join a configured runtime network
  such as `agenthub_local` through `RUNTIME_DOCKER_NETWORK`, so local service
  discovery and endpoint inspection are deterministic.
- Use MinIO as the local workspace storage backend. The runtime should provision
  deterministic object prefixes such as
  `tenants/{tenantId}/instances/{instanceId}/workspace/` and expose them to
  Hermes through `/workspace`.
- Do not bind-mount tenant data from arbitrary host directories. Any local
  filesystem cache must be AgentHub-managed, per-tenant/per-instance isolated,
  disposable, and backed by MinIO.

Production beta:

- Add a queue for instance lifecycle operations and task execution.
- Add a scheduler that maps tenant tier and requested isolation to runtime
  resource requests, limits, and runtime class.
- Add a reconciler that compares database desired state with actual runtime
  state and updates observed state, health, endpoint, and failure reason.
- Add a workspace storage abstraction with drivers for local MinIO and
  S3-compatible object storage. It owns prefix creation, sync/mount lifecycle,
  retention policy, quota accounting, and cleanup.

Kubernetes runtime:

- Tenant maps to a namespace such as `tenant-{id}`.
- Hermes instance maps to Deployment, Service, ConfigMap, and Secret.
- K8s runtime must not mount the host Docker socket. It implements the same
  RuntimeProvider contract by using Kubernetes API calls and watch events.
- Workspace backing storage is S3-compatible object storage. Pods should avoid
  node-local `hostPath`; use either object-store sync sidecars/init containers,
  a CSI/object-storage mount layer, or application-level SDK access while
  preserving the `/workspace` contract.
- NetworkPolicy defaults to deny and only allows DNS, ModelProxy, and required
  gateway/control-plane traffic.
- ResourceQuota and LimitRange map tenant plans to namespace and container
  resource limits.
- PodSecurity defaults to restricted.
- RuntimeClass supports `runc`, `gvisor`, and `kata`.

## TDD Matrix

Auth and tenant:

- Better Auth sign-up creates an active `User`; the API-token bridge ensures a
  free active `Tenant` and owner `Member` exist before issuing the temporary API
  JWT.
- Better Auth sign-in creates a session cookie; `POST /auth/api-token` signs
  the temporary MVP JWT with `sub=user.id`, `platformRole`, `activeTenantId`,
  and `memberRole`.
- Inactive or banned users cannot log in; users without an active tenant
  membership cannot access tenant-scoped APIs.
- JwtStrategy returns `userId` from `payload.sub` and tenant context from
  `payload.activeTenantId`.
- Admin guard allows only users with platform role `admin` or `super_admin`.
- Organization/tenant guards authorize tenant operations through `Member.role`.
- Tenant-scoped controllers ignore client-supplied `tenantId`.

Instance and runtime:

- Creating an instance uses JWT tenant context and persists
  `desiredStatus=running`, `observedStatus=pending`, and `health=unknown`.
- Runtime contract tests cover create, start, stop, delete, status, and logs.
- Docker provider tests verify image, container name, resource limits, labels,
  non-privileged mode, network, and security options.
- Runtime failures result in `observedStatus=failed` and a failure reason.
- Start, stop, and delete are idempotent.
- Reconciler tests cover running, stopped, deleted, failed, and unknown actual
  states.

Workspace storage:

- Creating an instance provisions a workspace prefix scoped by tenant and
  instance id.
- Docker MVP uses the MinIO/S3-compatible storage driver and never accepts a
  user-supplied host path.
- Runtime create requests include workspace metadata needed to expose
  `/workspace` inside Hermes.
- Workspace credentials are short-lived instance credentials or scoped secrets;
  they are not tenant LLM provider keys.
- Stopping or deleting an instance follows the retention policy: persist,
  archive, or delete workspace data.
- K8s manifests never use `hostPath` for tenant workspace data and configure the
  selected S3/object-storage mount or sync mechanism.

ModelProxy and LLM provider:

- Tenant provider overrides platform default provider.
- Task/project provider overrides tenant default provider.
- API keys are masked in API responses and never returned in full.
- Provider base URLs reject SSRF targets such as localhost, cluster-internal IPs,
  metadata IPs, and non-HTTP(S) schemes.
- Quota failures return resource-exhausted errors and record rejection events.
- Usage is recorded for streaming and non-streaming requests.

Task, queue, and scheduler:

- Task creation verifies the instance belongs to the current tenant.
- Task status moves through pending, running, and completed or failed.
- Worker retries do not duplicate lifecycle side effects.
- Unhealthy instances block task execution.
- Scheduler maps tenant tiers to CPU, memory, and runtime class.
- Inactive or unpaid tenants cannot schedule new work.

Kubernetes:

- Kubernetes provider generates Namespace, ResourceQuota, LimitRange,
  NetworkPolicy, Deployment, Service, ConfigMap, and Secret manifests.
- Hermes Deployment includes non-root user, no privilege escalation, dropped
  capabilities, read-only root filesystem, and no mounted service account token.
- NetworkPolicy has default deny and explicit DNS, ModelProxy, and gateway
  allowances.
- RuntimeClass selection defaults to `runc`, supports `gvisor`, and supports
  `kata` for stronger isolation.
- Watch controller handles Pending, Running, Ready, CrashLoopBackOff,
  ImagePullBackOff, and NodeNotReady.

Frontend:

- Add Vitest and React Testing Library.
- Use Ant Design for the MVP dashboard shell, forms, tables, cards, stats, and
  alerts.
- Keep one shared `/login` route and redirect the old `/admin/login` route to
  `/login`.
- Auth guards route unauthenticated users to login and block non-admin users
  from platform admin views.
- User dashboard routes and platform admin routes use separate layouts.
- Login and register forms use Better Auth client and exchange the Better Auth
  session for the temporary API token.
- Dashboard renders API data instead of hard-coded zero values.
- Instance page shows pending after create and updates when status changes.
- Settings supports adding provider config, testing it, setting default, and
  masking API keys.

Integration:

- Control-plane tests mock Prisma, Redis, queue, and runtime provider.
- Go data-plane unit tests use fake Docker and fake K8s clients.
- Optional smoke test covers register, login, create instance, status, and stop.
- K8s manifest golden tests ensure generated YAML stays secure and stable.

## Test Commands

- `cd ts-control-plane && npm test`
- `cd go-data-plane && go test ./...`
- `cd frontend && npm test` after Vitest is added
