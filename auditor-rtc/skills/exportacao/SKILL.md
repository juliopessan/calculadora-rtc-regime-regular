---
name: exportacao
description: Gera o arquivo de importação para o ERP a partir de um lote. Use quando o escritório precisar levar a classificação certificada para o sistema do cliente.
---

# Exportação para ERP
- Endpoint: `GET /api/lotes/<id>/export`.
- CSV UTF-8 com BOM, separador `;`, vírgula decimal. Colunas exatas: `codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao`.
- Campos que começam com `=`, `+`, `-` ou `@` recebem `'` na frente (proteção contra fórmula no Excel).
