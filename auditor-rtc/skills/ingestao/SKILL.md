---
name: ingestao
description: Lê o cadastro exportado do ERP (CSV em UTF-8 ou Latin-1, separado por ';' ou ','), detecta colunas, normaliza NCM e remove duplicados. Use antes de qualquer classificação.
---

# Ingestão do cadastro
- Colunas obrigatórias: `descricao` (ou produto/nome) e `ncm`. Opcionais: `codigo` (sku/cod), `gtin` (ean/código de barras).
- NCM: remova pontuação; com 7 dígitos, recoloque o zero à esquerda que o Excel tirou; menos de 7 ou mais de 8 dígitos → `PENDENTE_CLIENTE` ("NCM inválido").
- Duplicado = mesma descrição normalizada + mesmo NCM + mesmo GTIN. Conte e informe.
- Limite de 50.000 linhas por lote.
- Implementação: `ingerirCsv` em `packages/pipeline/src/ingest.ts`.
