# Auditor RTC v1.1 — Design (aprovado em 19/11/2026)

Base: `2026-11-18-auditor-cadastro-rtc-design.md` (v1). Esta versão não muda o pipeline de classificação.

## Intenção
Tirar do caminho o trabalho mecânico dos três próximos passos (conjunto de ouro, revisão do cenário, validação jurídica), atender clientes do Simples sem motor novo e aplicar a identidade Ledger às telas do produto.

## Decisões da análise (19/11)
- **Simples Nacional:** o motor `calculadora-rtc-simples-nacional` roda sobre o mesmo banco (as 7 tabelas existem), mas o cálculo não recebe NCM e o filtro atividade × cClassTrib devolve as mesmas 15 atividades para qualquer código (inclusive `410004`). Não acrescenta validação de classificação. **Não integrar agora**; reavaliar quando a integração com o PGDAS-D (Release 16) existir. Clientes do Simples usam o pipeline atual; o lote passa a registrar o regime.
- **Gerador de DANFSE:** serviço Go para PDF de NFS-e. Fora do escopo (sem emissão, sem serviços na v1). **Não integrar.**

## Escopo (ordem aprovada)
1. **Ledger nas telas do produto** (landing, cadastro/login, app). O relatório `/r/<token>` permanece neutro, com a marca do escritório. O app deixa de usar a cor do escritório (seria uma sexta cor).
2. **Regime do cliente no lote:** `regular` | `simples`, escolhido no upload, exibido no lote e no relatório. Sem efeito na classificação até validação com contador.
3. **Conjunto de ouro e calibração:** todo SKU decidido por modelo e depois revisado por humano é uma amostra rotulada (`correto` = cClassTrib final igual à escolha original do modelo). Tela de calibração com amostras, curva por faixa de confiança, limiar sugerido para 99% de precisão com **mínimo de 300 amostras**. Só o contador responsável aplica o limiar sugerido (ou desliga). Lotes novos herdam o limiar do escritório.
4. **Revisão do cenário pelo contador:** página com os códigos permitidos (concordo/discordo + comentário) e os excluídos (marcar "deveria ser permitido"). Só o contador responsável assina. Aviso no painel enquanto o cenário vigente não tiver revisão assinada. As discordâncias alimentam a próxima versão do JSON; nada é bloqueado.
5. **Perguntas para o advogado:** documento em `docs/juridico/`, sem parecer.

## Não-objetivos
Motor do Simples, DANFSE, importação de planilha de rótulos (a revisão no produto já gera os rótulos), aplicação de limiar arbitrário, mudança no pipeline.

## Restrições
- Regras de produto da v1 continuam (nenhum valor do modelo; sem limiar, tudo vai para revisão).
- Ledger: cinco cores, cantos retos, sem sombras ou gradientes, Archivo/Instrument Serif/Plex Mono, um botão sólido por tela, serifa itálica só no marketing, Proof Panel honesto (números medidos com fonte, ou rotulados como modelo).
- O relatório nunca mostra a nossa marca.
- Rótulos que o E2E usa permanecem: "Aprovar …", "Concluir e assinar lote", "Relatório do cliente".

## Decisões técnicas
- Rotas de produto num grupo `(produto)` com layout que carrega `ledger.css`, fontes e sprite de ícones; o relatório tem CSS próprio.
- `ledger.js` em `public/`, com um componente cliente que chama `Ledger.motion.scan/refresh` a cada troca de rota; revelação animada só na landing.
- Proof Panel da landing com números medidos em 18/11/2026: 85 → 10 cClassTribs válidos para o NCM 10063021 após o cenário; decisão do Jev em 340 ms; fonte do "93%": IOB, jul/2026.
