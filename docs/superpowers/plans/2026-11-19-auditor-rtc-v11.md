# Auditor RTC v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a Ledger às telas do produto, registrar o regime do cliente, entregar calibração a partir das revisões humanas e a revisão do cenário pelo contador, mais o roteiro jurídico.

**Architecture:** Sobre o MVP em `auditor-rtc/`. Rotas do produto passam a um grupo `(produto)` com layout Ledger; o relatório mantém CSS neutro. Três migrações novas (004–006). Pipeline inalterado; o worker passa a gravar a escolha original do modelo.

**Tech Stack:** o mesmo do MVP + assets da skill Ledger (`ledger.css`, `ledger.js`, `ledger-icons.svg`).

**Spec:** `docs/superpowers/specs/2026-11-19-auditor-rtc-v11-design.md` (e a v1, `2026-11-18-auditor-cadastro-rtc-design.md`)

## Global Constraints
- Ledger: tokens e classes de `ledger.css` sem reescrever; cinco cores; cantos retos; um `.btn` sólido por tela; Instrument Serif só na landing; status = ícone + palavra.
- `/r/<token>` não carrega `ledger.css` e nunca mostra "Auditor RTC".
- Rótulos usados pelo E2E permanecem: `Aprovar <código>`, `Concluir e assinar lote`, `Relatório do cliente`, `Fila de revisão (N)`.
- `MIN_AMOSTRAS_CALIBRACAO = 300`, `PRECISAO_ALVO = 0.99`.
- Só `contador_responsavel` aplica limiar e assina revisão de cenário.
- Regime: literais `regular` | `simples`; padrão `regular`.

## Review Focus
1. **Navegação interna esconde seções reveladas** (landing → login → landing): conteúdo visível sempre. Teste: E2E navega de volta e confere a visibilidade do `h2` (Task 6).
2. **Aplicar limiar diferente do sugerido** via API forjada: 422 (Task 4).
3. **Revisão de cenário incompleta** (faltando código permitido) ou com código inexistente: 422 (Task 5).
4. **Lote antigo sem `escolha_modelo`** não conta como amostra e não quebra a calibração (Task 4).
5. **Relatório acessado direto** carrega sem CSS Ledger (Task 6).

## File Structure
```
apps/web/app/layout.tsx                      raiz mínima (html/body)
apps/web/app/(produto)/layout.tsx            Ledger: fontes, ledger.css, sprite, ledger.js, LedgerRefresh
apps/web/app/(produto)/{page,login,cadastro,app/**}   páginas movidas e reestilizadas
apps/web/app/r/[token]/{page.tsx,relatorio.css}       relatório neutro
apps/web/app/(produto)/ledger.css, public/ledger.js, lib/icons.ts
apps/web/app/(produto)/app/calibracao/page.tsx, app/(produto)/app/cenario/page.tsx
apps/web/app/api/{calibracao,calibracao/aplicar,cenario/revisao}/route.ts
packages/db/migrations/004_regime.sql, 005_calibracao.sql, 006_revisao_cenario.sql
docs/juridico/perguntas-para-advogado.md
```

---

### Task 1: Layout Ledger e landing
**Files:** move `app/{page.tsx,landing.module.css,simulador-margem.tsx,login,cadastro,app}` → `app/(produto)/…`; create `app/(produto)/layout.tsx`, `app/(produto)/ledger.css` (cópia), `public/ledger.js` (cópia), `lib/icons.ts` (lê o sprite no build), `components/ledger-refresh.tsx`; root `app/layout.tsx` sem CSS; delete `app/globals.css` (o relatório ganha CSS próprio na Task 2).
**Interfaces:** Produces `LedgerRefresh` (client; on `usePathname()` change → `window.Ledger?.motion?.scan(document); window.Ledger?.motion?.refresh()`).
- [ ] Step 1: Test `test/simulador.test.ts` continua passando (o import muda para `@/lib/simulador`, que fica); `next build` ok.
- [ ] Step 2: Landing com mast (brandmark "A" + "Auditor RTC", nav "Como funciona · Preço · Entrar", badge "Piloto"), split hero (eyebrow "Reforma Tributária do Consumo", headline "Revisão de cadastro para a Reforma Tributária," + `<i class="wipe">com a sua marca.</i>`, lede, `.btn` "Quero um piloto" + `.link` "Como funciona"), Proof Panel (título "Candidatos por NCM", meta "arroz · 10063021"; barra cost "Válidos no motor" 85 (100%); barra save "Após o cenário v1" 10 (12%); stats "88%" "menos opções" + "340 ms" "por decisão"; note "Medido em 18/11/2026 no motor oficial 1.6.1 e no Jev. Um produto, não uma média."; foot "medição única · não é média"); pilares `.cells--3` (C Classificador / V Verificador / R Revisão); `.rail` com os 4 passos; simulador em `.block`; foot com aviso de não-endosso e `data-theme-toggle`.
- [ ] Step 3: Commit `feat(web): Ledger na landing e layout do produto`.

### Task 2: Ledger em auth e app; relatório neutro
**Files:** `components/form-auth.tsx` (`.field/.input/.btn--block`, `.field-error` form-level `role=alert`), `app/(produto)/{login,cadastro}/page.tsx` (`.auth` + aside com Proof Panel compacto: "93%" "dos cadastros com inconsistência" + "2,5 mi" "produtos analisados", note "Fonte: IOB, jul/2026. Não é dado deste produto."), `app/(produto)/app/layout.tsx` (`.shell` + `.side` nav: Lotes, Novo lote, Calibração, Cenário, Equipe*, Marca* (*sócio) + `.top` com nome do escritório, papel e `BotaoSair`), páginas do app com `.page-head`, `.cells--4` KPIs, `.tbl-wrap/.tbl`, `.badge` com ícone por status, `.empty`; `components/fila-revisao.tsx` e `acoes-lote.tsx` com `.block`, `.btn` só em "Aprovar"/"Concluir e assinar lote"; `app/r/[token]/relatorio.css` neutro (system-ui, cinzas, cor do escritório só em borda e nome) e `components/relatorio-view.tsx` usando classes `rel-*`.
- [ ] Step 1: Tests existentes do web (28) passam; `test/export.test.ts` "renders the office brand and never ours" continua.
- [ ] Step 2: `next build` ok. Commit `feat(web): Ledger em auth e app; relatório neutro`.

### Task 3: Regime do cliente
**Files:** `packages/db/migrations/004_regime.sql` (`lotes.regime text not null default 'regular' check in ('regular','simples')`); `repos.criarLote` aceita `regime`; `Lote.regime`; `POST /api/lotes` lê `regime` (padrão `regular`, outro valor → 422 "Regime inválido"); upload com `.seg`/select; lote e relatório mostram "Regime: Regime regular | Simples Nacional".
- [ ] Step 1: Failing tests em `apps/web/test/api.test.ts`: `stores regime=simples`; `regime inválido → 422`; `regime padrão regular`.
- [ ] Steps 2–4 RED/GREEN. Commit `feat: regime do cliente no lote`.

### Task 4: Calibração a partir das revisões
**Files:** `005_calibracao.sql` (`skus.escolha_modelo text, confianca_modelo numeric, backend_modelo text`; `escritorios.threshold numeric null`; tabela `calibracoes(id, escritorio_id, amostras int, threshold numeric null, precisao numeric, cobertura numeric, aplicado_por uuid, criado_em)` com RLS e grants); worker grava `escolha_modelo/confianca_modelo/backend_modelo` quando `decisao.backend !== 'deterministico'` e `escolha_modelo` ainda é null; `repos.amostrasRotuladas(c): LabeledDecision[]` (skus `CERTIFICADO_REVISADO` com `escolha_modelo` não nulo; `correct = c_class_trib = escolha_modelo`); `repos.limiarEscritorio(c)`, `repos.aplicarLimiar(c, {threshold, amostras, precisao, cobertura, usuarioId})`; `POST /api/lotes` usa o limiar do escritório; `GET /api/calibracao` → `{amostras, minimo: 300, alvo: 0.99, relatorio: CalibrationReport, limiarAtual}`; `POST /api/calibracao/aplicar {threshold: number|null}` (só contador → 403; `threshold` ≠ `relatorio.threshold` e ≠ null → 422 "Aplique o limiar sugerido pela calibração"); página `/app/calibracao`.
- [ ] Step 1: Failing tests: worker `stores the model choice once` (apps/worker); web `GET returns null threshold below 300 samples`; `labels compare final with model choice` (seed 300 amostras via SQL: 297 corretas conf ≥0,9 + 3 erradas conf 0,5 → threshold 0.9); `analyst cannot apply → 403`; `forged threshold → 422`; `apply sets escritório threshold and new lotes inherit it`; `null turns it off`; `legacy sku without escolha_modelo is ignored`.
- [ ] Steps 2–4. Commit `feat: calibração a partir das revisões humanas`.

### Task 5: Revisão do cenário pelo contador
**Files:** `006_revisao_cenario.sql` (`revisoes_cenario(id, escritorio_id, cenario_versao, usuario_id, itens jsonb, sugeridos jsonb, discordancias int, criado_em)`, RLS, grants SELECT/INSERT); `POST /api/cenario/revisao {itens: {codigo, decisao: 'concordo'|'discordo', comentario?}[], sugeridos?: string[]}` (só contador → 403; precisa cobrir exatamente os códigos permitidos do cenário → senão 422 "Revise todos os códigos permitidos"; `sugeridos` só códigos de 6 dígitos fora da lista); `repos.ultimaRevisaoCenario(c, versao)`; `lib/engine.ts getEngine()` (ENGINE_URL); página `/app/cenario` (permitidos com descrição do motor e motivo; excluídos NF-e em `<details>` com checkbox; motor indisponível → mensagem e lista só com o JSON); aviso no painel de lotes quando não há revisão da versão vigente.
- [ ] Step 1: Failing tests: `contador signs a complete review`; `incomplete → 422`; `unknown code → 422`; `analyst → 403`; `ultimaRevisaoCenario returns latest`.
- [ ] Steps 2–4. Commit `feat: revisão do cenário pelo contador responsável`.

### Task 6: Jurídico, E2E e screenshots
**Files:** `docs/juridico/perguntas-para-advogado.md`; `e2e/fluxo.test.ts` (+ regime "Simples Nacional" no upload; volta landing via link e confere `h2` visível; relatório sem `ledger.css` — `getComputedStyle(body).fontFamily` não contém "Archivo"; calibração mostra "0 de 300"; cenário: contador assina e o aviso some).
- [ ] Step 1: Update e2e; run `e2e/run-e2e.sh` → PASS; screenshots.
- [ ] Step 2: Commit `test(e2e): v1.1 e documento jurídico`.
