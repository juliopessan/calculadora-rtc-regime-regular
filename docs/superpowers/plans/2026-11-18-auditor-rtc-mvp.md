# Auditor RTC — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fatia vertical do MVP: upload do cadastro → classificação (Jev) entre candidatos válidos → verificação no motor oficial → roteamento por confiança → fila de revisão do contador → Lote Certificado com marca do escritório. Inclui landing page, login, dashboard e backend.

**Architecture:** Monorepo pnpm em `auditor-rtc/` (provisoriamente dentro deste fork; o design prevê repositório próprio). Pacotes puros em TypeScript (`classifier` genérico, `tax-pack` fiscal, `pipeline` = skill líder), `db` com Postgres e RLS por tenant, `apps/worker` processando lotes e `apps/web` em Next.js (landing, auth, dashboard, API). O motor oficial roda como processo/container Java separado, versão fixada.

**Tech Stack:** Node 22, pnpm 10, TypeScript 5 (strict), Vitest, Next.js 15 (App Router), Postgres 16 (`pg`), `jose` (sessão), `bcryptjs`, `papaparse`, `@modelcontextprotocol/sdk`, Playwright (já instalado no ambiente). Motor: este repositório (Spring Boot 3.5, Java 21, SQLite ro).

**Spec:** `docs/superpowers/specs/2026-11-18-auditor-cadastro-rtc-design.md`

## Global Constraints

- Escopo v1: mercadorias, venda interna, CRT 3, NF-e (`siglaDfe` = `NFe`)/NFC-e; NCM validado, **não** reclassificado.
- Nenhum valor tributário vem do modelo; o modelo só escolhe entre candidatos gerados pelas tabelas do motor.
- Fundamento legal vem de dados do motor, nunca de texto gerado.
- Sem limiar calibrado (`threshold === null`), **tudo** vai para revisão humana.
- Status de SKU (literais exatos): `CERTIFICADO_AUTO`, `CERTIFICADO_REVISADO`, `PENDENTE_CLIENTE`, `NAO_SUPORTADO`, mais os internos `NA_FILA`, `EM_REVISAO`, `ERRO_TEMPORARIO`.
- Cobrança: só `CERTIFICADO_AUTO` e `CERTIFICADO_REVISADO` são medidos.
- Papéis (literais exatos): `socio`, `contador_responsavel`, `analista`. Só `contador_responsavel` conclui (assina) lote.
- Para fora (Jev) vai só `{ descricao, ncm }`. Nunca CNPJ, preço ou nome do cliente.
- O cliente final nunca vê a nossa marca: o relatório usa nome, cor e logo do escritório.
- Aviso MIT da Calculadora (© Receita Federal do Brasil) presente em `auditor-rtc/engine/NOTICE`. Comunicação: "verificado com o motor de cálculo de código aberto da Receita Federal", sem sugerir endosso.
- Todo texto de UI em PT-BR.

## Review Focus

1. **NCM vindo do Excel**: `1006.30.21`, `2013000` (zero à esquerda perdido), espaços. Normalizar para 8 dígitos (remover não-dígitos, `padStart(8,'0')`); com menos de 7 ou mais de 8 dígitos → `PENDENTE_CLIENTE`. Teste em Task 7.
2. **CSV brasileiro**: separador `;`, encoding Latin-1 e cabeçalhos com acento/maiúsculas (`Descrição`, `NCM`). Detectar o separador e decodificar Latin-1 quando o UTF-8 for inválido. Teste em Task 7.
3. **Jev ou motor fora do ar no meio do lote**: o SKU vira `ERRO_TEMPORARIO` (nunca certificado), o lote é retomável e o worker reprocessa só esses SKUs. Teste em Task 9.
4. **Acesso cruzado entre escritórios** adivinhando id de lote/SKU: responde 404, e o RLS bloqueia mesmo com query sem filtro. Testes em Task 8 e Task 12.
5. **Analista tentando concluir lote** ou aprovar com cClassTrib fora dos candidatos: 403 e 422, respectivamente. Teste em Task 12.

## File Structure

```
auditor-rtc/
  package.json · pnpm-workspace.yaml · tsconfig.base.json · vitest.workspace.ts · .env.example · README.md
  engine/        run-engine.sh (gera banco + sobe JAR do motor) · Dockerfile · NOTICE
  scripts/       test-db.sh (sobe Postgres efêmero local para testes)
  packages/
    classifier/  src/{types,classify,fake-backend,jev-backend,calibrate,index}.ts   ← núcleo genérico
    tax-pack/    src/{engine-client,ncm,candidates,verify,index}.ts                 ← domínio fiscal
    pipeline/    src/{types,ingest,router,run-sku,index}.ts                          ← skill líder (código)
    db/          migrations/001_init.sql · src/{pool,migrate,tenant,repos/*}.ts
    mcp/         src/server.ts                                                       ← ferramentas MCP
  apps/
    worker/      src/{process-lote,main}.ts
    web/         app/{page.tsx, login/, cadastro/, app/(dashboard)/..., r/[token]/, api/...} · lib/{auth,session}.ts
  skills/        lider-auditoria/SKILL.md + ingestao, candidatos, classificador, verificador, dossie, exportacao
```

---

### Task 1: Workspace + núcleo genérico do classificador

**Files:**
- Create: `auditor-rtc/{package.json,pnpm-workspace.yaml,tsconfig.base.json,vitest.workspace.ts,.gitignore}`
- Create: `auditor-rtc/packages/classifier/{package.json,tsconfig.json}`, `src/types.ts`, `src/classify.ts`, `src/fake-backend.ts`, `src/index.ts`
- Test: `auditor-rtc/packages/classifier/test/classify.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Candidate = { id: string; description: string };
  type AtomicCheck = { name: string; question: string };
  type ClassifyInput = { state: Record<string, unknown>; instruction: string; candidates: Candidate[]; checks?: AtomicCheck[] };
  type Decision = { choice: string; confidence: number; probabilities: Record<string, number>;
                    checks: Record<string, number>; backend: string; modelVersion: string };
  interface DecisionBackend { name: string; decide(input: ClassifyInput): Promise<Decision> }
  class ClassifierUnavailableError extends Error {}
  function classify(input: ClassifyInput, backend: DecisionBackend): Promise<Decision>
  class FakeBackend implements DecisionBackend  // constructor(script: (input) => Partial<Decision>)
  ```

- [ ] **Step 1: Write failing tests** in `classify.test.ts`:
  - `zero candidates` → rejeita com `Error('sem candidatos')`.
  - `single candidate short-circuits` → `{choice: c.id, confidence: 1, probabilities: {[c.id]:1}, backend:'deterministico', modelVersion:'n/a'}`, e o backend **não** é chamado (spy).
  - `delegates to backend when >1 candidate` → devolve a decisão do FakeBackend.
  - `rejects backend choice outside candidates` → backend devolve `choice:'999999'` → lança `Error('escolha fora dos candidatos')`.
  - `more than 255 candidates` → lança `Error('máximo de 255 candidatos')`.
- [ ] **Step 2:** `pnpm -C auditor-rtc install && pnpm -C auditor-rtc --filter @auditor/classifier test` → FAIL (module not found).
- [ ] **Step 3: Implement** os tipos, `classify` e `FakeBackend`. O workspace usa ESM, `"type":"module"`, `tsconfig` strict, e os pacotes são consumidos por fonte (`"exports": "./src/index.ts"`).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(auditor): workspace e núcleo genérico do classificador`

### Task 2: Backend Jev

**Files:**
- Create: `auditor-rtc/packages/classifier/src/jev-backend.ts`
- Test: `auditor-rtc/packages/classifier/test/jev-backend.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `class JevBackend implements DecisionBackend` with `constructor(opts: { baseUrl?: string; model?: string; apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number; retries?: number })`. Defaults: `baseUrl='https://api.typesafe.ai'`, `model='jev-latest'`, `timeoutMs=10000`, `retries=2`. `apiKey` default `process.env.TYPESAFE_API_KEY ?? 'proxy-injected'`.

Mapeamento da requisição (`POST {baseUrl}/v1/systemone`, header `Authorization: Bearer <apiKey>`):
`{ model, state: input.state, questions: { escolha: { type:'choice', instructions: input.instruction, criteria: {[id]: description} }, ...checks→{[name]: {type:'noul', instructions: question}} } }`.
Resposta: `answers.escolha.{choice,confidence,probabilities}` e `answers[name].noul` → `Decision.checks[name]`. `modelVersion = response.model`, `backend='jev'`.

- [ ] **Step 1: Failing tests** com `fetchImpl` falso:
  - `builds request body` → captura o body e confere `questions.escolha.criteria` e um `noul` para cada check.
  - `maps response` → resposta do teste de fumaça (`{"model":"jev-1.14.0","answers":{"escolha":{"type":"choice","choice":"200003","confidence":0.88,"probabilities":{"000001":0.08,"200003":0.92}},"alimento":{"type":"noul","noul":0.98}}}`) → `Decision` com `checks.alimento === 0.98`.
  - `retries on 5xx then succeeds` (2 falhas, 1 sucesso → 3 chamadas).
  - `throws ClassifierUnavailableError after retries / on timeout`.
  - `4xx is not retried` → 1 chamada e lança `ClassifierUnavailableError` com o status na mensagem.
  - `live` (só quando `JEV_LIVE=1`): o caso do arroz → `choice === '200003'`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (backoff de 200·2^n ms; `AbortController` para o timeout). **Step 4:** run → PASS; `JEV_LIVE=1` → PASS.
- [ ] **Step 5: Commit** `feat(classifier): backend Jev (TypeSafe System One)`

### Task 3: Calibração

**Files:** Create `auditor-rtc/packages/classifier/src/calibrate.ts`; Test `test/calibrate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LabeledDecision = { confidence: number; correct: boolean };
  type CalibrationReport = { buckets: { lo: number; hi: number; n: number; precision: number }[];
                             threshold: number | null; coverageAtThreshold: number; precisionAtThreshold: number };
  function calibrate(samples: LabeledDecision[], targetPrecision: number, minSamples = 50): CalibrationReport
  ```
  `threshold` = menor confiança `t` (entre os valores observados) tal que a precisão das amostras com `confidence ≥ t` seja ≥ `targetPrecision` **e** `n ≥ minSamples`; senão `null`. Buckets de 0,1 em 0,1.
- [ ] **Step 1: Failing tests:** `null when fewer than minSamples`; `finds lowest threshold meeting 0.99` (100 amostras: as com conf ≥ 0,9 sempre corretas, abaixo 50% → `threshold === 0.9`); `coverage is fraction auto-approved`; `buckets sum to n`.
- [ ] **Steps 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(classifier): calibração de limiar por precisão-alvo`

### Task 4: Motor oficial em execução + EngineClient

**Files:**
- Create: `auditor-rtc/engine/run-engine.sh`, `auditor-rtc/engine/Dockerfile`, `auditor-rtc/engine/NOTICE`
- Create: `auditor-rtc/packages/tax-pack/{package.json,tsconfig.json}`, `src/engine-client.ts`, `src/index.ts`
- Test: `auditor-rtc/packages/tax-pack/test/engine-client.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Classificacao = { codigo: string; cst: string; descricao: string; nomenclatura: string;
                         descricaoTratamentoTributario: string; dfes: string[]; possuiPercentualReducao: boolean };
  type ItemCalculo = { ncm: string; cst: string; cClassTrib: string; baseCalculo: number };
  type ResultadoItem = { estadoItem: 'CALCULADO'|'CALCULO_SIMULADO'|'INCONSISTENCIA_ENTRADA'|'NAO_IMPLEMENTADO'|'FALHA_TECNICA';
                         erros: { code: string; detail: string }[]; memoriaCalculo?: string };
  class EngineUnavailableError extends Error {}
  class EngineClient {
    constructor(opts: { baseUrl: string; fetchImpl?: typeof fetch; aliquotas?: { cbs: number; ibsEstadual: number; ibsMunicipal: number } });
    versao(): Promise<string>;                                   // GET /dados-abertos/versao
    ncmExiste(ncm: string, data: string): Promise<boolean>;      // GET /dados-abertos/ncm  (2xx → true, 4xx → false)
    classificacoes(data: string): Promise<Classificacao[]>;      // GET /dados-abertos/classificacoes-tributarias/cbs-ibs
    ncmAplicavel(cClassTrib: string, ncm: string, data: string): Promise<boolean>; // .../ncm-aplicavel → .valido
    calcularItem(item: ItemCalculo, data: string, municipio: number, uf: string): Promise<ResultadoItem>; // POST /observabilidade/regime-geral
  }
  ```
  `baseUrl` inclui `/api/calculadora`. `cst = codigo.slice(0,3)`. `dfes = tiposDfeClassificacao.map(t => t.sigla)` (ex.: `'NF-e'`, `'NFC-e'`). `versao()` = `` `${versaoApp}/${versaoDb}` `` (resposta real: `{"versaoApp":"1.6.1","versaoDb":"V0059",...}`). `memoriaCalculo` = `objetos[0].tribCalc.IBSCBS.gIBSCBS.gCBS.memoriaCalculo` quando existir. `ncm` inexistente → HTTP 404. Em `calcularItem`, se o ano de `data` ≥ 2027, envia `aliquotasNominais` = `opts.aliquotas ?? { cbs: 8.8, ibsEstadual: 0.05, ibsMunicipal: 0.05 }` (valores de `docs/exemplos.md`); antes de 2027, não envia. `dhFatoGerador = ${data}T10:00:00-03:00`. Erros de rede ou 5xx → `EngineUnavailableError`.
- `run-engine.sh`: a partir da raiz do fork, `mkdir -p calculadora/db`, roda o Flyway (`flyway-pro.conf`) se o `.db` não existir, `./mvnw -DskipTests package` se não houver JAR, sobe com `java -jar target/*.jar --spring.profiles.active=offline` na porta `${ENGINE_PORT:-8080}` e espera `/api/calculadora/dados-abertos/versao` responder 200.
- [ ] **Step 1: Failing tests** (pulam se `ENGINE_URL` não estiver definida): `versao returns non-empty`; `ncmExiste('10063021','2026-11-18') true` e `('99999999') false`; `classificacoes includes 000001 with cst 000`; `ncmAplicavel('200003','10063021') true`; `calcularItem valid (000/000001, base 100) → CALCULADO|CALCULO_SIMULADO`; `calcularItem 200/200035 with NCM 02013000 → INCONSISTENCIA_ENTRADA with REG-011` (caso de `docs/exemplos.md`). Mais um teste unitário com fetch falso: `5xx → EngineUnavailableError`.
- [ ] **Step 2:** `ENGINE_URL=http://localhost:8080/api/calculadora pnpm --filter @auditor/tax-pack test` → FAIL.
- [ ] **Step 3:** implement; confirme os nomes de campos com `curl` contra o motor rodando antes de mapear.
- [ ] **Step 4:** run → PASS. **Step 5: Commit** `feat(tax-pack): cliente do motor oficial e script de execução`

### Task 5: Normalização de NCM + geração de candidatos

**Files:** Create `auditor-rtc/packages/tax-pack/src/{ncm.ts,candidates.ts}`; Test `test/{ncm,candidates}.test.ts`

**Interfaces:**
- Consumes: `EngineClient` (Task 4).
- Produces:
  ```ts
  function normalizarNcm(raw: string): string | null   // Review Focus 1
  type Candidato = Classificacao;
  class CandidateIndex {
    constructor(engine: Pick<EngineClient,'classificacoes'|'ncmAplicavel'>, data: string, opts?: { dfe?: string; concurrency?: number });
    candidatosPara(ncm: string): Promise<Candidato[]>;  // cache em memória por ncm
  }
  ```
  Algoritmo: carrega `classificacoes(data)` uma vez; filtra `dfes.includes(dfe ?? 'NF-e')` (sigla real do motor, com hífen) **e** a lista de permissões do cenário; para cada NCM, testa `ncmAplicavel` em paralelo (`concurrency` padrão 16) e guarda o resultado. Ordena por `codigo`.
  - **Cenário v1** = arquivo versionado `packages/tax-pack/cenarios/venda-interna-v1.json`: `{ "versao": "v1", "revisadoPor": null, "permitidos": [{ "codigo": "...", "motivo": "..." }] }`. Fato medido em 18/11/2026: para o NCM 10063021 (arroz), o motor considera 85 cClassTribs válidos, a maioria dependente da operação (suspensão, diferimento, transferência, exportação, doação). A v1 permite só tratamentos determinados pelo produto: `000001, 200003, 200004, 200007, 200009, 200013, 200014, 200030, 200031, 200032, 200033, 200034, 200035, 200036, 200038, 200053, 410008, 410009`. Ficam excluídos os que dependem de comprador, vendedor ou operação (ex.: 2000xx para administração pública, produtor rural, ZFM e cooperativas; 410 de operação/sujeito; 5xx, 620 combustíveis, 8xx). **Essa lista é decisão técnica provisória e exige revisão de contador** (`revisadoPor` permanece `null` até isso acontecer).
  - Código presente no motor e **ausente** do JSON (tabela nova) → fora dos candidatos, contado em `CandidateIndex.ignorados` para alerta.
- [ ] **Step 1: Failing tests:** `normalizarNcm('1006.30.21')==='10063021'`, `('2013000')==='02013000'`, `(' 10063021 ')==='10063021'`, `('123')===null`, `('123456789')===null`; `candidatosPara uses cache` (fake engine conta as chamadas: segunda chamada sem novas consultas); `filters by dfe`; live (com `ENGINE_URL`): `candidatosPara('10063021')` contém `200003`.
- [ ] **Steps 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(tax-pack): normalização de NCM e índice de candidatos`

### Task 6: Verificador

**Files:** Create `auditor-rtc/packages/tax-pack/src/verify.ts`; Test `test/verify.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Verificacao = { ok: boolean; estadoItem: ResultadoItem['estadoItem']; erros: ResultadoItem['erros'];
                       memoriaCalculo?: string; motorVersao: string };
  function verificar(engine: EngineClient, ncm: string, c: Candidato, ctx: { data: string; municipio: number; uf: string; motorVersao: string }): Promise<Verificacao>
  ```
  `ok = estadoItem ∈ {CALCULADO, CALCULO_SIMULADO}`. Usa `baseCalculo: 100` (verificação de consistência, não de valor). Contexto padrão do MVP: `municipio: 4314902`, `uf: 'RS'` (de `docs/exemplos.md`), configurável por env `VERIFY_MUNICIPIO`/`VERIFY_UF`.
- [ ] **Step 1: Failing tests** (fake engine): `ok for CALCULO_SIMULADO`; `not ok and carries REG codes for INCONSISTENCIA_ENTRADA`; `propagates EngineUnavailableError`.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(tax-pack): verificação no motor oficial`

### Task 7: Pipeline (skill líder): ingestão, roteador e execução por SKU

**Files:** Create `auditor-rtc/packages/pipeline/src/{types,ingest,router,run-sku,index}.ts`; Tests `test/{ingest,router,run-sku}.test.ts`

**Interfaces:**
- Consumes: `classify`, `DecisionBackend`, `ClassifierUnavailableError` (Tasks 1–2); `normalizarNcm`, `CandidateIndex`, `verificar`, `EngineUnavailableError` (Tasks 4–6).
- Produces:
  ```ts
  type SkuStatus = 'NA_FILA'|'CERTIFICADO_AUTO'|'CERTIFICADO_REVISADO'|'EM_REVISAO'|'PENDENTE_CLIENTE'|'NAO_SUPORTADO'|'ERRO_TEMPORARIO';
  type SkuEntrada = { codigo: string; descricao: string; ncmBruto: string; gtin?: string };
  type IngestResult = { skus: SkuEntrada[]; duplicados: number; erros: { linha: number; motivo: string }[] };
  function ingerirCsv(buf: Uint8Array): IngestResult
  type SkuResultado = { status: SkuStatus; ncm: string | null; decisao?: Decision; candidatos?: Candidato[];
                        escolhido?: Candidato; verificacao?: Verificacao; motivo?: string; tentativas: number };
  type Politica = { threshold: number | null; maxTentativas: number };   // padrão { threshold: null, maxTentativas: 3 }
  function rotear(d: Decision, v: Verificacao, p: Politica): 'CERTIFICADO_AUTO' | 'EM_REVISAO'
  function executarSku(sku: SkuEntrada, deps: { index: CandidateIndex; backend: DecisionBackend; engine: EngineClient;
                       ctx: { data: string; municipio: number; uf: string; motorVersao: string }; politica: Politica }): Promise<SkuResultado>
  ```
  - `ingerirCsv`: decodifica UTF-8 (`fatal:true`) e, se falhar, Latin-1; detecta `;` ou `,` pela primeira linha; cabeçalhos normalizados (minúsculas, sem acento): `codigo|sku|cod`, `descricao|produto|nome`, `ncm`, `gtin|ean|codigo de barras`. Sem coluna `descricao` ou `ncm` → `erros=[{linha:0, motivo:'colunas obrigatórias: descricao, ncm'}]`, `skus=[]`. Dedupe por `(descricao normalizada, ncm normalizado, gtin)`. Limite: 50.000 linhas; acima disso, erro na linha 0.
  - `executarSku`, em ordem: NCM inválido → `PENDENTE_CLIENTE` ("NCM inválido"); NCM inexistente/não vigente (`engine.ncmExiste`) → `PENDENTE_CLIENTE`; 0 candidatos → `PENDENTE_CLIENTE` ("NCM sem classificação vinculada"); `classify` com `state={descricao, ncm}` (nada mais) e instrução fixa `"Qual classificação tributária IBS/CBS (cClassTrib) se aplica a esta mercadoria em venda interna no regime regular?"`; verifica o escolhido; se falhar, remove o candidato e reclassifica até `maxTentativas`; esgotou → `EM_REVISAO` com `motivo` = códigos REG; `NAO_IMPLEMENTADO` → `NAO_SUPORTADO`; `ClassifierUnavailableError`/`EngineUnavailableError` → `ERRO_TEMPORARIO`; ok → `rotear`.
  - `rotear`: `threshold===null` → `EM_REVISAO`; `v.ok && d.confidence >= threshold` → `CERTIFICADO_AUTO`; senão `EM_REVISAO`.
- [ ] **Step 1: Failing tests** (fakes): ingestão com `;` + Latin-1 + `Descrição` (Review Focus 2); `NCM '2013000' normalizado` (RF1); faltando coluna; dedupe conta 1; rotear com null → EM_REVISAO, 0,95≥0,9 → AUTO, ok=false → EM_REVISAO; executarSku: candidato único sem chamar o backend; retry após REG-011 escolhe o próximo; backend lança Unavailable → ERRO_TEMPORARIO; NAO_IMPLEMENTADO → NAO_SUPORTADO; `state` enviado ao backend tem exatamente as chaves `descricao`, `ncm`.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(pipeline): skill líder — ingestão, roteamento e execução por SKU`

### Task 8: Banco multi-tenant com RLS

**Files:** Create `auditor-rtc/scripts/test-db.sh`, `auditor-rtc/packages/db/{package.json,tsconfig.json}`, `migrations/001_init.sql`, `src/{pool,migrate,tenant,index}.ts`, `src/repos/{escritorios,usuarios,lotes,skus,auditoria}.ts`; Test `test/{tenant,repos}.test.ts`

**Interfaces:**
- Produces:
  - Tabelas: `escritorios(id uuid pk, nome, cor_primaria default '#1f4e79', logo_url null, criado_em)`; `usuarios(id, escritorio_id fk, email unique, senha_hash, nome, papel check in ('socio','contador_responsavel','analista'))`; `clientes(id, escritorio_id, nome, cnpj)`; `lotes(id, escritorio_id, cliente_id, status check in ('NA_FILA','PROCESSANDO','EM_REVISAO','CONCLUIDO'), data_referencia date, motor_versao, threshold numeric null, total, duplicados, token_relatorio unique, concluido_por fk usuarios null, concluido_em, criado_em)`; `skus(id, escritorio_id, lote_id, codigo, descricao, ncm_bruto, ncm, gtin, status, cst, c_class_trib, confianca, probabilidades jsonb, candidatos jsonb, verificacao jsonb, motivo, tentativas int default 0, revisado_por, atualizado_em)`; `eventos_auditoria(id bigserial, escritorio_id, lote_id, sku_id null, usuario_id null, tipo, dados jsonb, criado_em)`, append-only (trigger que rejeita UPDATE/DELETE).
  - RLS: `ENABLE` + `FORCE ROW LEVEL SECURITY` em todas as tabelas com `escritorio_id`; policy `escritorio_id = current_setting('app.escritorio_id', true)::uuid`. A tabela `usuarios` também tem policy de login por e-mail via função `SECURITY DEFINER auth_buscar_usuario(email)`.
  - O app conecta como role `auditor_app` (não dona das tabelas). Migrations rodam como dona.
  - `function withTenant<T>(escritorioId: string, fn: (c: PoolClient) => Promise<T>): Promise<T>` (transação + `set_config('app.escritorio_id', id, true)`).
  - `function withSystem<T>(fn)` para o worker: role `auditor_worker` com `BYPASSRLS`, usado só em `apps/worker`.
  - Repos com funções nomeadas: `criarEscritorioComSocio`, `buscarUsuarioPorEmail`, `criarLote`, `listarLotes`, `obterLote`, `inserirSkus`, `listarSkus(loteId, status?)`, `atualizarSku`, `concluirLote`, `registrarEvento`, `contarCobraveis(loteId)`.
- `test-db.sh`: `initdb` num diretório do scratch, `pg_ctl start` na porta 55432, cria o banco `auditor_test` e exporta `DATABASE_URL`/`DATABASE_URL_APP`/`DATABASE_URL_WORKER`.
- [ ] **Step 1: Failing tests:** `RLS isolates tenants` (escritório A cria lote; `withTenant(B)` com `SELECT * FROM lotes` sem WHERE → 0 linhas; `obterLote(B, idDeA)` → null) — Review Focus 4; `auditoria is append-only` (UPDATE lança erro); `contarCobraveis counts only CERTIFICADO_*`.
- [ ] **Steps 2–4** (`scripts/test-db.sh && pnpm --filter @auditor/db test`). **Step 5: Commit** `feat(db): esquema multi-tenant com RLS e auditoria append-only`

### Task 9: Worker de lotes + medição

**Files:** Create `auditor-rtc/apps/worker/{package.json,tsconfig.json}`, `src/process-lote.ts`, `src/main.ts`; Test `test/process-lote.test.ts`

**Interfaces:**
- Consumes: `executarSku`, `Politica` (Task 7); repos e `withSystem` (Task 8); `EngineClient`, `CandidateIndex` (Tasks 4–5); `JevBackend` (Task 2).
- Produces: `function processarLote(loteId: string, deps: { backend: DecisionBackend; engine: EngineClient; politica: Politica }): Promise<{ processados: number; temporarios: number }>`. Pega SKUs `NA_FILA` ou `ERRO_TEMPORARIO`, executa com concorrência 8, persiste cada resultado e registra o evento `sku_processado`. Status final do lote: `EM_REVISAO` se algum SKU estiver `EM_REVISAO`/`ERRO_TEMPORARIO`, senão `EM_REVISAO` também (só o contador conclui). `motor_versao` vem de `engine.versao()` e é gravado no lote. `main.ts` faz polling a cada 5 s de lotes `NA_FILA`, usa `SELECT ... FOR UPDATE SKIP LOCKED` e marca `PROCESSANDO`. A política vem de `lotes.threshold` (null = tudo para revisão).
- [ ] **Step 1: Failing tests** (Postgres real, fakes de backend e engine): `processes all skus and records events`; `engine down mid-lote → those skus ERRO_TEMPORARIO, rerun processes only them` (Review Focus 3); `threshold null → no CERTIFICADO_AUTO`.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(worker): processamento retomável de lotes`

### Task 10: Web — auth e sessão

**Files:** Create `auditor-rtc/apps/web` (Next.js 15, App Router, TS, sem Tailwind: CSS modules + variáveis CSS), `lib/session.ts`, `lib/auth.ts`, `app/login/page.tsx`, `app/cadastro/page.tsx`, `app/api/auth/{login,logout,cadastro}/route.ts`, `middleware.ts`; Test `test/auth.test.ts`

**Interfaces:**
- Produces: `type Sessao = { usuarioId: string; escritorioId: string; papel: Papel; nome: string }`; `criarSessao(s): Promise<string>` (JWT HS256 via `jose`, 12 h, cookie `auditor_sessao` httpOnly, secure em produção, SameSite=Lax); `lerSessao(req|cookies): Promise<Sessao|null>`; `exigirPapel(s, ...papeis)` lança `RespostaHttp(403)`. Segredo: `SESSION_SECRET` (obrigatório; falha no boot se ausente). `/cadastro` cria escritório + usuário `socio` (bcrypt cost 10). O middleware redireciona `/app/*` para `/login` sem sessão.
- [ ] **Step 1: Failing tests** (route handlers chamados direto com `Request`): cadastro → login devolve o cookie; senha errada → 401 com mensagem genérica "E-mail ou senha inválidos"; sessão adulterada → null; `exigirPapel(analista,'contador_responsavel')` → 403.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(web): cadastro de escritório, login e sessão`

### Task 11: Web — landing page

**Files:** Create `auditor-rtc/apps/web/app/page.tsx`, `app/landing.module.css`, `app/simulador-margem.tsx` (client component)

**Interfaces:**
- Produces: `function margemEscritorio(i: { clientes: number; precoPorCliente: number; skusPorCliente: number; custoPorSku: number }): { receita: number; custo: number; margem: number }` em `lib/simulador.ts` (puro, testado).
- Conteúdo (copy fixa): H1 "Revisão de cadastro para a Reforma Tributária, com a sua marca."; subtítulo "Cada SKU classificado, verificado com o motor de cálculo de código aberto da Receita Federal e entregue com dossiê legal. Seu time só revisa as exceções."; seções "Como funciona" (Envie o cadastro · Classificamos e verificamos · Você revisa as exceções e assina · Entregue com a sua marca), "Garantia" ("Se um SKU certificado causar rejeição por classificação, nós creditamos e reclassificamos."), simulador de margem com padrões `{clientes:100, precoPorCliente:500, skusPorCliente:800, custoPorSku: 0.25}` e rótulo "custo por SKU (hipotético)", CTA "Quero um piloto" → `/cadastro`. Rodapé com o aviso de não-endosso.
- [ ] **Step 1: Failing test** `test/simulador.test.ts`: `{100,500,800,0.25}` → `receita 50000, custo 20000, margem 30000`.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(web): landing page e simulador de margem`

### Task 12: Web — dashboard, upload e fila de revisão

**Files:** Create `auditor-rtc/apps/web/app/app/{layout.tsx,page.tsx}`, `app/app/lotes/novo/page.tsx`, `app/app/lotes/[id]/page.tsx`, `app/app/marca/page.tsx`, `app/api/lotes/route.ts` (POST multipart, GET), `app/api/lotes/[id]/concluir/route.ts`, `app/api/skus/[id]/decisao/route.ts`, `app/api/marca/route.ts`; Test `test/api.test.ts`

**Interfaces:**
- Consumes: `ingerirCsv` (Task 7); repos e `withTenant` (Task 8); `lerSessao`/`exigirPapel` (Task 10).
- Produces/behavior:
  - `POST /api/lotes` (`cliente`, `arquivo`, `dataReferencia` padrão hoje) → cria o lote `NA_FILA` com SKUs `NA_FILA`; resposta `{id, total, duplicados, erros}`. Erro de ingestão na linha 0 → 422 com a mensagem.
  - `POST /api/skus/:id/decisao` `{acao:'aprovar'|'trocar'|'devolver', cClassTrib?, justificativa?}`: `trocar` exige `cClassTrib` ∈ `skus.candidatos` (senão 422 "cClassTrib fora dos candidatos válidos"); `aprovar`/`trocar` → `CERTIFICADO_REVISADO`; `devolver` → `PENDENTE_CLIENTE`. Todos os papéis podem decidir SKU. Cada decisão gera evento.
  - `POST /api/lotes/:id/concluir`: só `contador_responsavel` (senão 403); exige 0 SKUs `EM_REVISAO`/`NA_FILA`/`ERRO_TEMPORARIO` (senão 409 com a contagem); grava `concluido_por/em`, gera `token_relatorio` (32 bytes base64url) e o evento `lote_assinado`.
  - Ids de outro escritório → 404 (RLS).
  - Dashboard `/app`: tabela de lotes (cliente, status, total, % auto, em revisão, cobráveis). `/app/lotes/[id]`: resumo + fila de revisão, onde cada SKU em revisão mostra descrição, NCM, top-3 candidatos com probabilidade, `descricaoTratamentoTributario` e REG/motivo, e os botões Aprovar / Trocar (select limitado aos candidatos) / Devolver ao cliente. `/app/marca`: nome, cor, URL do logo (só `socio`).
- [ ] **Step 1: Failing tests:** upload Latin-1 cria lote com `total` correto; `trocar` fora dos candidatos → 422; analista concluindo → 403 (Review Focus 5); concluir com pendências → 409; lote de outro escritório → 404 (Review Focus 4).
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(web): dashboard, upload de lote e fila de revisão`

### Task 13: Relatório white-label + exportação

**Files:** Create `auditor-rtc/apps/web/app/r/[token]/page.tsx` (+ CSS de impressão), `app/api/lotes/[id]/export/route.ts`, `lib/export.ts`; Test `test/export.test.ts`

**Interfaces:**
- Produces: `function exportarCsv(skus: SkuLinha[]): string`, separador `;`, UTF-8 com BOM, colunas exatas `codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao`. `/r/[token]` é público (sem login), acessível só com token de lote concluído, e renderiza o nome, a cor e o logo **do escritório** (nenhuma menção à nossa marca), o resumo, a tabela de SKUs certificados com fundamento, a versão do motor e da tabela, quem assinou e quando, e o aviso de não-endosso. CSS `@media print` para "Salvar como PDF".
- [ ] **Step 1: Failing tests:** cabeçalho CSV exato + BOM; descrição com `;` vem entre aspas; o HTML do relatório (render do componente servidor) contém o nome do escritório e **não** contém "Auditor RTC"; token inválido → 404.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(web): relatório white-label e exportação para ERP`

### Task 14: Skills + servidor MCP

**Files:** Create `auditor-rtc/skills/lider-auditoria/SKILL.md` e `skills/{ingestao,candidatos,classificador,verificador,dossie,exportacao}/SKILL.md`; `auditor-rtc/packages/mcp/{package.json,src/server.ts}`; Test `packages/mcp/test/server.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: servidor MCP stdio com as ferramentas `buscar_candidatos {ncm, data}`, `classificar {descricao, ncm, data}`, `verificar_no_motor {ncm, cClassTrib, data}`, `explicar_erro_reg {codigo}` (proxy para `GET /observabilidade/erros?codigo=`). Cada SKILL.md tem um frontmatter `name`/`description` e diz quando usar, que ferramentas MCP chamar e as regras inegociáveis (Global Constraints). A skill líder descreve o pipeline da §6 do design e delega às especialistas.
- [ ] **Step 1: Failing test:** `listTools` devolve as 4 ferramentas; `buscar_candidatos` com engine fake devolve os códigos.
- [ ] **Steps 2–4.** **Step 5: Commit** `feat(mcp): skills especialistas e servidor MCP`

### Task 15: E2E com motor real

**Files:** Create `auditor-rtc/e2e/fluxo.spec.ts`, `auditor-rtc/e2e/fixtures/cadastro-latin1.csv`, `auditor-rtc/README.md`

- [ ] **Step 1:** fixture com 5 linhas (`;`, Latin-1): arroz `10063021`, cerveja `22030000`, carne `02013000`, NCM `123` (inválido), linha duplicada.
- [ ] **Step 2: Test (Playwright, Chromium pré-instalado):** cadastro → login → novo lote → o worker processa (motor real + `FakeBackend` determinístico via `CLASSIFIER_BACKEND=fake`) → a página do lote mostra 4 SKUs (1 duplicado), o NCM inválido em `PENDENTE_CLIENTE` e os demais em revisão (threshold null) → aprova todos → o `socio` não consegue concluir (botão ausente/403) → cria um `contador_responsavel` via SQL de fixture → conclui → `/r/<token>` mostra o nome do escritório.
- [ ] **Step 3:** run → PASS. `README.md`: como subir motor, Postgres, worker e web; variáveis de `.env.example` (`DATABASE_URL*`, `SESSION_SECRET`, `ENGINE_URL`, `CLASSIFIER_BACKEND=jev|fake`, `TYPESAFE_API_KEY`, `VERIFY_MUNICIPIO`, `VERIFY_UF`).
- [ ] **Step 4: Commit** `test(e2e): fluxo completo com motor oficial`

---

## Fora deste plano (próximos planos)
Backend Claude de fallback e narrativa de exceções; integração com provedor de pagamento (aqui só há a medição); reauditoria por versão de motor/tabela; PDF nativo; SPED; NBS/NFS-e; SSO/MFA; montagem do conjunto de ouro e rodada real de calibração (a ferramenta existe na Task 3); deploy.
