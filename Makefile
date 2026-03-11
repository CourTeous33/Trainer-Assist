.PHONY: up down seed dev-api dev-frontend dev build clippy test logs

# Docker (all services)
up:
	docker compose up -d --build

down:
	docker compose down

seed:
	docker compose run --rm seed

logs:
	docker compose logs -f

# Local dev (outside Docker, uses .env ports)
infra-up:
	docker compose up -d postgres redis

infra-down:
	docker compose down

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
