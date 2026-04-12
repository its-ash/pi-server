SHELL := /bin/bash

.PHONY: install backend frontend dev build-backend build-frontend build clean

install:
	cd backend && cargo fetch
	cd frontend && npm install

backend:
	cd backend && RUST_LOG=info cargo run

frontend:
	cd frontend && npm run dev -- --host 0.0.0.0 --port 5173

dev:
	@set -euo pipefail; \
	trap 'kill 0' INT TERM EXIT; \
	(cd backend && RUST_LOG=info cargo run) & \
	(cd frontend && npm run dev -- --host 0.0.0.0 --port 5173) & \
	wait

build-backend:
	cd backend && cargo build --release

build-frontend:
	cd frontend && npm run build

build: build-backend build-frontend

clean:
	rm -rf backend/target frontend/dist
