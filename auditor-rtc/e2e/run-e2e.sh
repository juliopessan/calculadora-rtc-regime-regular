#!/usr/bin/env bash
# E2E completo: Postgres efêmero + motor oficial (ENGINE_URL) + worker + web (build de produção).
# Pré-requisito: motor rodando (auditor-rtc/engine/run-engine.sh). Uso: auditor-rtc/e2e/run-e2e.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
eval "$(scripts/test-db.sh)"
DB=auditor_e2e
psql "$DATABASE_URL" -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -qc "CREATE DATABASE $DB" >/dev/null
export DATABASE_URL="${DATABASE_URL%/*}/$DB" DATABASE_URL_APP="${DATABASE_URL_APP%/*}/$DB" DATABASE_URL_WORKER="${DATABASE_URL_WORKER%/*}/$DB"
(cd packages/db && node --experimental-strip-types --no-warnings src/cli-migrate.ts)

export ENGINE_URL="${ENGINE_URL:-http://localhost:8080/api/calculadora}"
export SESSION_SECRET="e2e-segredo-de-sessao-com-mais-de-32-chars"
export CLASSIFIER_BACKEND=fake WORKER_POLL_MS=300 E2E_BASE_URL="http://localhost:3100"

# Servidor de execução anterior na porta 3100 testaria o build velho: encerra e confirma.
# (o Next renomeia o processo para "next-server", então procura pelo nome também)
pkill -f "next start -p 3100" 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true; sleep 1
if curl -s -o /dev/null "http://localhost:3100"; then echo "porta 3100 ocupada por outro processo" >&2; exit 1; fi
[ -d apps/web/.next ] || (cd apps/web && npx next build >/dev/null)
# Cada serviço no próprio grupo de processos, para a saída encerrar também os filhos.
setsid bash -c 'cd apps/web && exec npx next start -p 3100' > /tmp/auditor-e2e-web.log 2>&1 & WEB=$!
setsid bash -c 'cd apps/worker && exec node --experimental-strip-types --no-warnings src/main.ts' > /tmp/auditor-e2e-worker.log 2>&1 & WRK=$!
trap 'kill -- -$WEB -$WRK 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "$E2E_BASE_URL" >/dev/null && break; sleep 1; done

npx vitest run --config e2e/vitest.config.ts
