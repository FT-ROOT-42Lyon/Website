.DEFAULT_GOAL := help
.PHONY: help install setup env dev build start \
        db-up db-down db-logs db-migrate db-reset db-studio db-generate \
        clean reclean re

# ─── Help ────────────────────────────────────────────────────────────────────
help:
	@echo "ft_root — Plateforme — Makefile"
	@echo ""
	@echo "  Setup:"
	@echo "    make setup        First-time: copies .env files, installs, starts DB, migrates"
	@echo "    make env          Copy .env.example files if missing"
	@echo "    make install      pnpm install"
	@echo ""
	@echo "  Dev:"
	@echo "    make dev          Run back + front in parallel (foreground)"
	@echo "    make build        Build all packages"
	@echo "    make start        Run built back + front"
	@echo ""
	@echo "  Database:"
	@echo "    make db-up        Start postgres (docker compose)"
	@echo "    make db-down      Stop postgres"
	@echo "    make db-logs      Tail postgres logs"
	@echo "    make db-migrate   Run pending migrations (creates one if schema changed)"
	@echo "    make db-generate  Regenerate Prisma client only"
	@echo "    make db-studio    Open Prisma Studio"
	@echo "    make db-reset     Drop, recreate, re-migrate (DESTROYS DATA)"
	@echo ""
	@echo "  Clean:"
	@echo "    make clean        Remove node_modules / build artifacts"
	@echo "    make reclean      clean + remove DB volume"
	@echo "    make re           reclean + setup + dev"

# ─── Setup ───────────────────────────────────────────────────────────────────
setup: env install db-up db-migrate
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start."

env:
	@if [ ! -f back/.env ]; then cp back/.env.example back/.env && echo "→ created back/.env"; fi
	@if [ ! -f front/.env.local ]; then cp front/.env.example front/.env.local && echo "→ created front/.env.local"; fi

install:
	pnpm install

# ─── Dev ─────────────────────────────────────────────────────────────────────
dev:
	pnpm dev

build:
	pnpm build

start:
	pnpm -r --parallel run start

# ─── Database ────────────────────────────────────────────────────────────────
db-up:
	docker compose up -d postgres
	@echo "→ waiting for postgres to be healthy..."
	@until docker compose exec -T postgres pg_isready -U ftroot -d ftroot >/dev/null 2>&1; do sleep 1; done
	@echo "✓ postgres ready"

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-migrate:
	pnpm --filter @ft-root/back run db:migrate

db-generate:
	pnpm --filter @ft-root/back run db:generate

db-studio:
	pnpm --filter @ft-root/back run db:studio

db-reset:
	cd back && pnpm exec prisma migrate reset --force

# ─── Clean ───────────────────────────────────────────────────────────────────
clean:
	rm -rf node_modules back/node_modules front/node_modules shared/node_modules
	rm -rf back/dist front/.next shared/dist
	rm -rf back/src/generated

reclean: clean
	docker compose down -v

re: reclean setup dev
