.DEFAULT_GOAL := help
.PHONY: help install setup env dev build start \
        db-up db-down db-logs db-migrate db-reset db-studio db-generate \
        db-export db-import \
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
	@echo "    make db-export    Dump DB to dumps/<timestamp>.sql (or OUT=path)"
	@echo "    make db-import IN=path   Restore DB from a .sql dump"
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

# ─── Dump / restore ──────────────────────────────────────────────────────────
# `pg_dump --clean --if-exists` writes DROP statements before each CREATE so
# a restore is idempotent: importing into a populated DB drops the matching
# objects first, importing into an empty DB skips them gracefully.
db-export:
	@mkdir -p dumps
	@OUT_PATH="$${OUT:-dumps/$$(date +%Y%m%d-%H%M%S).sql}"; \
	echo "→ dumping postgres to $$OUT_PATH"; \
	docker compose exec -T postgres pg_dump -U ftroot --clean --if-exists ftroot > "$$OUT_PATH"; \
	echo "✓ wrote $$OUT_PATH ($$(du -h "$$OUT_PATH" | cut -f1))"

db-import:
	@test -n "$(IN)" || { echo "usage: make db-import IN=path/to/dump.sql"; exit 1; }
	@test -f "$(IN)"  || { echo "✗ file not found: $(IN)"; exit 1; }
	@echo "→ importing $(IN) into postgres"
	@docker compose exec -T postgres psql -U ftroot -d ftroot --quiet -v ON_ERROR_STOP=1 < "$(IN)"
	@echo "✓ db imported — run 'make db-generate' if the schema changed"

# ─── Clean ───────────────────────────────────────────────────────────────────
clean:
	rm -rf node_modules back/node_modules front/node_modules shared/node_modules
	rm -rf back/dist front/.next shared/dist
	rm -rf back/src/generated

reclean: clean
	docker compose down -v

re: reclean setup dev
