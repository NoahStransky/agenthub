"""AgentHub API Server — 多租户 Hermes 管理控制平面.

入口: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import auth, tenants, instances, projects, tasks, billing
from core.config import settings
from core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期: 启动时初始化数据库."""
    await init_db()
    yield


app = FastAPI(
    title="AgentHub API",
    description="多租户 AI Agent 管理平台",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
app.include_router(instances.router, prefix="/instances", tags=["Instances"])
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
app.include_router(billing.router, prefix="/billing", tags=["Billing"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
