# Auditor de Cadastro RTC — Design (service-as-software, white-label para escritórios contábeis)

> **Status:** rascunho para aprovação · **Data:** 18/11/2026 · **Nome do produto:** provisório ("Auditor RTC") — decisão em aberto.
>
> Este documento descreve o produto e a arquitetura. Ele **não** altera a Calculadora oficial deste repositório; o produto é uma **camada externa** que consome a Calculadora como motor de verificação.

---

## 1. Intenção e porquê

### O problema
Desde 03/08/2026 a NF-e do regime normal precisa trazer, item a item, o grupo IBS/CBS com **CST** e **cClassTrib** corretos. O gargalo do mercado não é o cálculo (a Calculadora oficial já resolve isso), e sim a **classificação do cadastro de produtos** e o **diagnóstico de rejeições**:

- 93% de 2,5 milhões de produtos analisados (4,5 mil empresas) tinham inconsistência cadastral/tributária (levantamento IOB, jul/2026).
- A Rejeição 1024 (cClassTrib incompatível com CST) trava o faturamento. A cadeia de erro típica é: NCM desatualizada → cClassTrib errado → rejeição.
- A tabela cClassTrib e a NT 2025.002 mudam com frequência (a NT já passou da versão 11). Uma planilha estática não resolve.

### Quem paga hoje
Escritórios contábeis já vendem "revisão de cadastro" como projeto (cerca de R$ 500 por cliente, segundo a imprensa do setor). 68% dos contadores já foram procurados por clientes sobre a Reforma, mas 56% não têm plano e o gargalo declarado é **executar com escala**.

### A tese
Com base em Sequoia, "Services: The New Software" (Julien Bek, mar/2026): para cada US$ 1 gasto em software, gasta-se cerca de US$ 6 em serviços. **Autopilots vendem o trabalho concluído, não a ferramenta.** A porta de entrada é o trabalho **já terceirizado e intensivo em regra**, e a revisão de cadastro é exatamente isso.

> Nota de fonte: não foi localizada citação do Gartner para a razão 1:6. No material comercial, atribuir apenas à Sequoia até que haja fonte.

### O produto em uma frase
> O escritório contábil envia o cadastro do cliente e recebe, **com a marca do escritório**, um **Lote Certificado**: cada SKU classificado, **verificado no motor oficial da Receita**, com dossiê de fundamento legal, arquivo pronto para importar no ERP e garantia contra rejeição. O contador só revisa as exceções e assina.

### Por que white-label (decisão do Julio)
Vender direto à PME colocaria o produto contra o próprio contador (o dilema do inovador). No white-label, o escritório é o canal e o responsável técnico, e o produto vira o **back-office** dele: o escritório revende com margem, e nós cobramos por resultado entregue.

---

## 2. Objetivos, não-objetivos e anti-objetivos

### Objetivos (v1)
1. Receber o cadastro de mercadorias de um cliente do escritório (CSV/XLSX; SPED em fase posterior) e devolver um **Lote Certificado**.
2. Classificar **CST + cClassTrib** de cada SKU escolhendo **apenas entre candidatos legalmente válidos** derivados das tabelas da Calculadora.
3. **Verificar** cada classificação rodando a Calculadora oficial (endpoint de observabilidade) e corrigir automaticamente o que gerar `REG-xxx` corrigível.
4. **Rotear por confiança calibrada**: o que fica acima do limiar é auto-aprovado; o resto entra na fila de revisão do contador responsável.
5. Gerar o **dossiê** por SKU (fundamento legal, versão das tabelas, memória de cálculo, decisão e quem aprovou) e a **exportação para ERP**.
6. **White-label**: logo, cores, domínio e relatório com a marca do escritório.
7. **Cobrança por resultado**: por SKU certificado.
8. **Reauditoria** quando a tabela cClassTrib/NCM ou o motor mudar, com alerta de quais SKUs certificados foram afetados.

### Não-objetivos (v1)
- Serviços/NBS/NFS-e (v2).
- Cenários além de **venda interna de mercadoria, regime normal (CRT 3), NF-e/NFC-e**. Exportação, devolução, bonificação, ZFM, monofásico e compras governamentais ficam para depois.
- Classificar **NCM do zero** a partir só da descrição. Na v1, o NCM informado é validado (existência e vigência) e sinalizado quando suspeito, mas não é reclassificado automaticamente.
- Emitir notas, apurar tributos, planejamento tributário ou formação de preço.
- Integração direta com ERPs. A v1 entrega arquivo de importação; conectores ficam para depois.
- Vender direto à PME.

### Anti-objetivos (fracasso mesmo que "funcione")
- **Número gerado por LLM.** Todo valor tributário vem do motor oficial; o modelo só escolhe entre opções válidas.
- **Lei inventada.** O fundamento legal é buscado nas tabelas (dados abertos da Calculadora), nunca redigido livremente pelo modelo.
- **Auto-aprovar sem calibração.** Se o limiar não for calibrado num conjunto de ouro, tudo vai para revisão humana (o modo seguro é o padrão).
- **Retirar a assinatura do profissional.** O produto não assume a responsabilidade técnica; o contador do escritório aprova e assina.
- **Competir com o escritório pelo cliente final.** O cliente final nunca vê a nossa marca.
- **Vazar o cadastro do cliente.** Para fora vai só o mínimo (descrição + NCM), nunca CNPJ, preço ou volume.

---

## 3. Restrições

| Restrição | Consequência para o design |
|---|---|
| Não existe API pública hospedada da Calculadora. A integração é pelo componente offline no ambiente do integrador (manual da Plataforma CBS). | Rodamos o motor **nós mesmos**, como serviço interno (container Java 21 + SQLite somente-leitura gerado por Flyway). |
| A Calculadora é MIT (© Receita Federal do Brasil). | Uso comercial permitido, mantendo o aviso de licença. Não usar a marca da Receita como se fosse produto oficial. |
| O banco do motor é SQLite `mode=ro`, trocado por arquivo versionado (ADR004). | A versão do motor e do banco é **fixada por lote** e gravada no dossiê. Atualizar o motor gera uma nova versão e dispara a reauditoria. |
| A partir de 2027, `aliquotasNominais` é obrigatório no cálculo, e o resultado sai como `CALCULO_SIMULADO`. | O verificador sempre envia as alíquotas de referência e trata `CALCULO_SIMULADO` como verificação válida. Os valores servem para checar consistência, não para cobrar imposto. |
| Jev (TypeSafe): early access, fornecedor único, `choice` com até 255 opções, sem geração de texto, servidores nos EUA. | Classificador atrás de **interface com backend trocável** (Jev padrão, Claude com saída estruturada como fallback). Para fora vai só descrição + NCM. Os termos de retenção de dados precisam ser revisados antes de produção (pendente). |
| LGPD e sigilo profissional do contador. | Isolamento por tenant, criptografia em repouso, retenção configurável, trilha de auditoria imutável. |
| Responsabilidade tributária. | O contrato posiciona o produto como suporte técnico, com o profissional habilitado do escritório assinando. **Requer validação jurídica** (ver §11). |

---

## 4. Abordagens consideradas

### 4.1 Produto
| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| **A** | Auditor-corretor de cadastro em lote, verificado no motor | Dor quantificada, orçamento existente, diferencial que depende do motor oficial | **Escolhida** |
| B | Tradutor de rejeição/erro (XML + rejeição → correção) | Bom valor, mas sem orçamento próprio | Módulo da v2 sobre o mesmo núcleo |
| C | Chat explicativo | Já commoditizado e é o que o próprio roadmap cogita | Descartada |

### 4.2 Comprador
| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| **White-label para escritórios** | Canal pronto, o escritório é o responsável técnico, sem conflito com o contador | Ciclo de venda B2B, dependência do canal | **Escolhida (Julio)** |
| PME direto | Margem maior por cliente | Compete com o contador, assume a responsabilidade, CAC alto | Descartada na v1 |

### 4.3 Motor de decisão do classificador
| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| **Jev (System One) + verificação no motor + Claude só para narrar exceções** | Rápido (cerca de 340 ms no teste), custo de inferência desprezível, confiança calibrada para rotear | Early access, fornecedor único | **Escolhida** |
| Só LLM com saída estruturada | Maduro, flexível | Mais caro e lento, confiança mal calibrada | Fallback |
| Regras fixas por NCM | Determinístico | Não cobre o que depende da descrição (ex.: cesta básica por tipo de produto) | Usado só para gerar candidatos |

---

## 5. O que é entregue: o "Lote Certificado"

Unidade de valor e de cobrança. Para cada SKU:

| Campo | Origem |
|---|---|
| SKU, descrição normalizada, NCM validado | Ingestão e normalização |
| CST e cClassTrib finais | Classificador mais verificação, ou decisão do revisor |
| Status: `CERTIFICADO_AUTO`, `CERTIFICADO_REVISADO`, `PENDENTE_CLIENTE`, `NAO_SUPORTADO` | Roteador |
| Confiança e probabilidades das alternativas | Jev |
| Fundamento legal (dispositivo da LC 214/2025) | Dados abertos da Calculadora (`fundamentacoes-legais`) |
| Resultado da verificação (`estadoItem`, códigos `REG-xxx` resolvidos, memória de cálculo) | Calculadora oficial |
| Versões: motor, banco, tabela cClassTrib, modelo do classificador | Registro de versões |
| Quem aprovou, quando e com qual justificativa | Trilha de auditoria |

Artefatos do lote: **relatório PDF com a marca do escritório**, **planilha de importação no ERP** (layout genérico CSV/XLSX na v1) e **dossiê JSON** por SKU.

`NAO_SUPORTADO` cobre o que está fora do escopo v1 (ex.: NBS, cenário especial) e o que o motor devolve como `NAO_IMPLEMENTADO`. O produto diz "não sei" explicitamente, não chuta e não cobra.

---

## 6. Pipeline do agente

```
 Upload (CSV/XLSX)
   │
   ▼
 1. Ingestão ── detecta colunas, valida schema, deduplica (descrição+GTIN+NCM)
   │
   ▼
 2. Normalização ── NCM existe e está vigente? (dados abertos /ncm) → senão: PENDENTE_CLIENTE
   │
   ▼
 3. Geração de candidatos ── CSTs × cClassTribs vinculados ao NCM, vigentes na data,
   │                         compatíveis com o cenário (venda interna, CRT 3)
   │      ├─ 0 candidatos → PENDENTE_CLIENTE (NCM sem vínculo)
   │      └─ 1 candidato  → pula para 5 (sem modelo)
   ▼
 4. Classificação (Jev) ── choice entre candidatos (≤255) + perguntas noul atômicas
   │                        (ex.: "é alimento para consumo humano?") combinadas em código
   ▼
 5. Verificação (motor oficial) ── POST /observabilidade/regime-geral com o item
   │      ├─ CALCULADO / CALCULO_SIMULADO → ok
   │      ├─ REG-xxx corrigível → próximo candidato (máx. N tentativas) → volta a 5
   │      └─ NAO_IMPLEMENTADO / FALHA_TECNICA → NAO_SUPORTADO / retry
   ▼
 6. Roteamento ── confiança ≥ limiar calibrado E verificação ok → CERTIFICADO_AUTO
   │              senão → fila de revisão
   ▼
 7. Revisão humana ── contador vê as top-3 alternativas, fundamento e diferença de imposto;
   │                  aprova / troca / devolve ao cliente. Claude redige a nota explicativa.
   ▼
 8. Montagem do lote ── dossiê, relatório com a marca do escritório, arquivo de importação, cobrança
   │
   ▼
 9. Vigilância ── nova versão do motor/tabela → reverifica os SKUs certificados → alerta
```

### Como gerar os candidatos (achado no código)
A Calculadora **não tem endpoint que liste os cClassTribs de um NCM**. Ela só **valida um par** em `GET /dados-abertos/classificacoes-tributarias/ncm-aplicavel?cClassTrib=&ncm=&dataOcorrenciaFatoGerador=` (`DadosAbertosController.java:424`). Por isso:

- **Caminho escolhido:** pré-computar uma **tabela de candidatos NCM × cClassTrib** por versão do motor. Lista-se `GET /classificacoes-tributarias/cbs-ibs` (cada cClassTrib já traz o CST) e valida-se cada par com `ncm-aplicavel`, uma vez por versão, com cache. Também filtra por `/classificacoes-tributarias/cbs-ibs/{siglaDfe}/{cClassTrib}` para manter só o que vale para NF-e/NFC-e.
- **Alternativa:** ler direto o SQLite somente-leitura da nossa instância do motor. É mais rápido, mas acopla ao esquema interno, que pode mudar entre versões. Fica como otimização.
- Se um NCM tiver mais de 255 candidatos (limite do `choice` do Jev), pré-filtrar em dois estágios: `noul` por grupo/anexo e depois `choice`.

### Por que o modelo não alucina o resultado
1. Ele **só escolhe** entre candidatos gerados pelas tabelas oficiais (é estruturalmente impossível sair um cClassTrib inexistente; isso elimina a Rejeição 1023).
2. A escolha é **verificada** pelo motor (CST↔cClassTrib e NCM↔cClassTrib; elimina 1024 e `REG-006`/`REG-011`).
3. Fundamento legal e valores **vêm de dados**, não de geração.
4. A **confiança calibrada** decide se um humano olha.

O risco que sobra é escolher um candidato **válido, porém errado** para aquele produto. Isso é exatamente o que a calibração, o limiar e a revisão humana tratam.

---

## 7. Arquitetura "skill leader"

> **Interpretação (minha, a confirmar):** "estilo skill leader" significa uma **skill líder** que orquestra **skills especialistas**, cada uma com uma responsabilidade única e ferramentas próprias (expostas por MCP). A mesma orquestração roda tanto no backend do SaaS (workers) quanto num agente Claude (uso interno / suporte).

```
                     ┌───────────────────────────────┐
                     │  lider-auditoria (skill líder)│
                     │  orquestra o pipeline, aplica │
                     │  política de roteamento/SLA   │
                     └───────────────┬───────────────┘
   ┌────────────┬────────────┬───────┴────┬─────────────┬────────────┬─────────────┐
   ▼            ▼            ▼            ▼             ▼            ▼             ▼
 ingestao   candidatos  classificador verificador   dossie      exportacao   vigilancia
 (parse,    (tabelas    (núcleo       (motor        (fundamento, (ERP, PDF    (versões de
 dedupe,    da          genérico +    oficial,      memória,     white-label) motor/tabela,
 NCM)       Calculadora) Jev)         REG→ação)     narrativa)                reauditoria)
```

### 7.1 Classificador reutilizável (núcleo genérico)
Fica num pacote **independente do domínio fiscal**, para uso em outros projetos:

```
classify(item, candidates[], atomic_checks[]) -> Decision {
  choice, confidence, probabilities, checks{}, backend, model_version
}
```

- **Backends:** `JevBackend` (padrão: `choice` + `noul` via `POST /v1/systemone`) e `ClaudeStructuredBackend` (fallback).
- **Pacotes de domínio:** o "tax pack" fornece `candidates()` (vínculos da Calculadora) e `verify()` (o motor). Outro projeto troca o pacote.
- **Calibração:** um utilitário mede a precisão por faixa de confiança num conjunto de ouro e sugere o limiar para a meta de precisão.

### 7.2 Servidor MCP
Expõe as ferramentas das skills (`buscar_candidatos`, `classificar`, `verificar_no_motor`, `explicar_erro_reg`, `gerar_dossie`) para que o agente Claude da equipe, ou de suporte, opere o mesmo pipeline em linguagem natural.

---

## 8. Estrutura SaaS

### 8.1 Mapa de superfícies

| Superfície | Público | Conteúdo v1 |
|---|---|---|
| **Landing page** | Sócios de escritórios contábeis | Proposta ("entregue revisão de cadastro com a sua marca, verificada no motor oficial"), como funciona, garantia, simulador de margem do escritório, prova (amostra de dossiê), CTA para piloto |
| **Login / auth** | Usuários do escritório | E-mail + senha e magic link; MFA opcional; convite por e-mail; SSO depois |
| **Dashboard** | Escritório | Ver §8.3 |
| **Portal white-label** | Cliente do escritório (opcional na v1) | Upload do cadastro e download do relatório, com a marca do escritório |
| **Backoffice interno** | Nossa operação | Tenants, versões do motor, filas, calibração, incidentes |

### 8.2 Modelo multi-tenant e papéis

```
Escritório (tenant, white-label)
 ├─ Usuários: Sócio(owner) · Contador responsável (assina) · Analista (revisa, não assina)
 └─ Clientes (CNPJ)
      └─ Lotes ── SKUs ── Decisões ── Eventos de auditoria
```

- Isolamento por tenant em todas as tabelas (row-level security no Postgres).
- Só o papel **Contador responsável** pode concluir um lote (assinatura).

### 8.3 Dashboard (o que o escritório vê)
- **Lotes**: status, % auto-certificado, itens em revisão, prazo do SLA.
- **Fila de revisão**: item → top-3 alternativas com probabilidades, fundamento de cada uma, diferença de IBS/CBS entre elas (calculada pelo motor) e botões aprovar / trocar / devolver ao cliente.
- **Carteira**: clientes, SKUs certificados, alertas de reauditoria ("a tabela mudou: 37 SKUs de 4 clientes precisam de nova verificação").
- **Negócio do escritório**: receita estimada com o serviço, custo do serviço, horas economizadas.
- **Marca**: logo, cores, domínio e texto do relatório.

### 8.4 Backend (componentes)

```
 [Web: landing + app]──►[API]──►[Postgres] (tenants, lotes, SKUs, decisões, auditoria)
                          │
                          ├──►[Fila de jobs]──►[Workers: pipeline / skill líder]
                          │                        ├──►[Serviço Classificador]──►Jev API / Claude
                          │                        ├──►[Motor oficial: Calculadora (Java) + SQLite ro]
                          │                        └──►[Gerador de relatórios]
                          ├──►[Storage de objetos] (uploads, relatórios; criptografado)
                          └──►[Billing por resultado]
```

| Componente | Decisão / proposta |
|---|---|
| Motor oficial | Container da Calculadora deste repo (versão fixada), banco gerado por Flyway no build da imagem, **sem acesso à internet**, réplicas idênticas. Cada versão de motor é uma imagem com tag. |
| Classificador | Serviço próprio com o pacote reutilizável (§7.1); cache por (descrição normalizada, NCM, versão das tabelas). |
| Workers | Idempotentes, com retry e backoff; processamento por SKU com estado persistido (o lote pode ser retomado). |
| Auditoria | Tabela de eventos somente-anexação (append-only) por decisão. |
| Billing | Medição por SKU `CERTIFICADO_*`; `NAO_SUPORTADO` e `PENDENTE_CLIENTE` não são cobrados; crédito automático se acionada a garantia. |
| Observabilidade | Métricas da §9 por tenant e por versão de motor/modelo. |

**Stack proposta (minha decisão, o builder pode ajustar):** TypeScript em front e API (Next.js), workers em TypeScript, Postgres, fila em Postgres ou Redis, o motor como container Java separado. O web pode ir para Vercel; motor e workers precisam de runtime de containers (ex.: Cloud Run, Fly ou Render). Um único idioma fora o motor reduz o custo de manutenção.

### 8.5 Modelo de preço (estrutura; números a calibrar)
- **O escritório paga por SKU certificado**, em faixas de volume, e define o preço ao cliente final (a margem é dele).
- **Âncora de mercado:** cerca de R$ 500 por revisão de cliente, cobrados hoje pelos escritórios.
- **Garantia:** se um SKU certificado causar rejeição por classificação dentro de X dias, o SKU é creditado e reclassificado com prioridade.
- **O custo variável dominante é a revisão humana do próprio escritório**, não a inferência (cerca de US$ 0,00002 por chamada ao Jev no teste de 18/11). Por isso a taxa de auto-certificação é a alavanca de margem de todos.

---

## 9. Métricas de sucesso

| Métrica | Definição | Meta inicial (hipótese) |
|---|---|---|
| Precisão auto-certificada | % de `CERTIFICADO_AUTO` corretos no conjunto de ouro | ≥ 99% (o limiar é escolhido para atingir isso) |
| Taxa de auto-certificação | % de SKUs suportados que não precisam de humano | Medir; é a métrica de margem |
| Rejeições pós-entrega | Rejeições 1023/1024 atribuíveis à classificação | Próximo de zero; aciona a garantia |
| Tempo de lote | Upload até lote assinado (1.000 SKUs) | Medir no piloto |
| Minutos de revisão por 100 SKUs | Esforço do contador | Medir no piloto |

---

## 10. Plano de entrega (fases)

| Fase | Entrega | Critério de saída |
|---|---|---|
| **0. Prova técnica** | Classificador + tax pack + verificador numa CLI; conjunto de ouro com cerca de 300 a 500 SKUs revisados por contador | Curva de calibração; limiar que atinge a precisão-alvo |
| **1. MVP interno** | Backend + dashboard mínimo (lotes e fila de revisão) + relatório | Um escritório piloto processa lotes reais com acompanhamento |
| **2. White-label** | Landing, auth multi-tenant, marca, billing por resultado, garantia | 3 a 5 escritórios pagantes |
| **3. Vigilância e B** | Reauditoria por versão; módulo tradutor de rejeição; SPED; NBS | Retenção pela vigilância contínua |

---

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Responsabilidade por classificação errada | Contador assina; contrato de suporte técnico; garantia limitada ao crédito; **parecer jurídico antes do lançamento** |
| Jev (early access, fornecedor único, dados nos EUA) | Interface trocável; fallback Claude; mínimo de dados enviados; revisar termos de retenção |
| Calibração não transferir entre setores | Conjunto de ouro por segmento (supermercado, materiais, autopeças...); limiar por segmento |
| Mudança de norma ou tabela | Versionamento por lote e reauditoria automática (isso vira argumento de venda) |
| Concorrência (ReformaSync, TributoIA, TaxHub, Ordix, Omie.IA etc.) | Diferencial: verificação no motor oficial, preço por resultado, white-label e garantia |
| Dependência do repositório oficial | Fork fixado por versão; acompanhar o CHANGELOG oficial; nunca alterar regra do motor |
| Associação indevida à marca da Receita | Comunicar "verificado com o motor de cálculo de código aberto da Receita Federal", sem sugerir endosso |

---

## 12. Decisões já tomadas

**Pelo Julio:**
- Abordagem A (auditor-corretor de cadastro em lote).
- Classificador do tipo Jev (TypeSafe), reutilizável em outros projetos.
- Posicionamento service-as-software (tese Sequoia 1:6).
- Comprador: escritórios contábeis, em white-label.
- SaaS com landing page, login, dashboard e backend, organizado em "skill leader".

**Minhas (marcadas para revisão):**
- Escopo v1: mercadorias, venda interna, CRT 3, NF-e/NFC-e; NCM validado, não reclassificado.
- Interpretação de "skill leader" como skill líder + especialistas (§7).
- Stack TypeScript/Next.js/Postgres + motor em container separado.
- Preço por SKU certificado, com garantia; `NAO_SUPORTADO` não é cobrado.
- Meta de precisão auto-certificada ≥ 99% como hipótese.
- Produto como repositório próprio (não dentro deste fork).

## 13. Deixado para o builder
- Formato exato do arquivo de importação e mapeamento de colunas.
- Escolha de fila, de provedor de auth e de hospedagem de containers.
- Design visual da landing e do dashboard (respeitando o white-label).
- Número de tentativas no loop de verificação e política de cache.
- Estrutura interna das skills e do servidor MCP.
