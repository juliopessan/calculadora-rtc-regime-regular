# Auditor RTC (MVP)

Revisão de cadastro para a Reforma Tributária, vendida como resultado (service-as-software) e em white-label para escritórios contábeis.
Cada SKU é classificado (CST + cClassTrib) **apenas entre candidatos válidos**, **verificado no motor oficial** da Calculadora de Tributos
(este repositório, MIT, © Receita Federal do Brasil) e roteado por confiança calibrada. O contador responsável revisa as exceções e assina.

- Design: `docs/superpowers/specs/2026-11-18-auditor-cadastro-rtc-design.md`
- Plano: `docs/superpowers/plans/2026-11-18-auditor-rtc-mvp.md`

> Provisório: este código vive em `auditor-rtc/` dentro do fork; o design prevê repositório próprio.

## Estrutura

| Caminho | Papel |
|---|---|
| `packages/classifier` | Núcleo **genérico** reutilizável: `classify()`, `JevBackend` (TypeSafe System One), `FakeBackend`, `calibrate()` |
| `packages/tax-pack` | Domínio fiscal: `EngineClient`, `CandidateIndex` (cenário `cenarios/venda-interna-v1.json`), `verificar()` |
| `packages/pipeline` | Skill líder em código: `ingerirCsv()`, `executarSku()`, `rotear()` |
| `packages/db` | Postgres multi-tenant com RLS, auditoria append-only, migrations |
| `packages/mcp` | Servidor MCP: `buscar_candidatos`, `classificar`, `verificar_no_motor`, `explicar_erro_reg` |
| `apps/worker` | Processa lotes (retomável; erros temporários são reprocessados) |
| `apps/web` | Next.js: landing, cadastro/login, dashboard, fila de revisão, marca, equipe, relatório white-label `/r/<token>`, exportação CSV |
| `skills/` | `lider-auditoria` + especialistas (`ingestao`, `candidatos`, `classificador`, `verificador`, `dossie`, `exportacao`) |
| `engine/` | Script e Dockerfile do motor oficial + `NOTICE` |

## Rodando localmente

Pré-requisitos: Node 22.18+, pnpm 10, Java 21, Postgres 16.

```bash
pnpm install
```

```bash
engine/run-engine.sh            # gera o banco do motor (Flyway), compila e sobe em :8080
```

```bash
eval "$(scripts/test-db.sh)"    # Postgres efêmero em :55432 (ou use o seu)
```

```bash
cp .env.example .env            # ajuste as variáveis
```

```bash
(cd packages/db && node --experimental-strip-types src/cli-migrate.ts)
```

```bash
(cd apps/worker && node --experimental-strip-types src/main.ts)
```

```bash
(cd apps/web && npx next dev -p 3000)
```

Servidor MCP (para um agente Claude): `ENGINE_URL=... node --experimental-strip-types packages/mcp/src/main.ts`.

## Testes

```bash
eval "$(scripts/test-db.sh)" && ENGINE_URL=http://localhost:8080/api/calculadora pnpm -r --workspace-concurrency=1 test
```

Ao vivo com o Jev: `NODE_USE_ENV_PROXY=1 JEV_LIVE=1` na frente do comando. E2E completo (motor rodando): `e2e/run-e2e.sh`.

## Regras do produto (não negociáveis)

- Nenhum valor tributário vem do modelo; o modelo só escolhe entre candidatos e o motor verifica.
- Sem limiar calibrado (`lotes.threshold` nulo), **tudo** vai para revisão humana.
- Para o Jev vai só `{descricao, ncm}`.
- O relatório do cliente mostra só a marca do escritório.
- A lista do cenário v1 (`cenarios/venda-interna-v1.json`) é **provisória e precisa de revisão de contador** antes de produção.
