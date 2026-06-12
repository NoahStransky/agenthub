.PHONY: dev-up dev-down dev-logs dev-build-hermes smoke-docker-mvp

dev-build-hermes:
	cd docker && docker compose --profile build build hermes-base

dev-up: dev-build-hermes
	cd docker && docker compose up -d --build postgres redis minio minio-init control-plane data-plane web

dev-down:
	cd docker && docker compose down

dev-logs:
	cd docker && docker compose logs -f control-plane data-plane web

smoke-docker-mvp:
	node scripts/docker-mvp-smoke.mjs
