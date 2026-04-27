.PHONY: up down seed dev-api dev-frontend dev build clippy test logs infra-up infra-down

COMPOSE     := docker compose
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

# Docker (production: base compose only — host ports are NOT published)
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

seed:
	$(COMPOSE) run --rm seed

logs:
	$(COMPOSE) logs -f

# Local dev (host ports published via docker-compose.dev.yml so cargo/npm can connect)
infra-up:
	$(COMPOSE_DEV) up -d postgres redis

infra-down:
	$(COMPOSE_DEV) down

dev-up:
	$(COMPOSE_DEV) up -d --build

dev-api:
	cd backend && cargo run -p api

dev-frontend:
	cd frontend && npm run dev

dev:
	cd backend && cargo run -p api & cd frontend && npm run dev

seed-local:
	cd backend && cargo run -p seed

# Build
build-api:
	cd backend && cargo build -p api --release

build-frontend:
	cd frontend && npm run build

clippy:
	cd backend && cargo clippy -- -D warnings

test:
	cd backend && cargo test
