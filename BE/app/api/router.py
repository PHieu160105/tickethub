"""Aggregate all HTTP API routers under the `/api` prefix."""

from fastapi import APIRouter

from app.api.routes import admin, customer


api_router = APIRouter(prefix="/api")

# Customer and public routes.
api_router.include_router(customer.router)

# Admin routes.
api_router.include_router(admin.router)
