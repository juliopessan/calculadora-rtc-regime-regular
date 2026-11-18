---
name: classificador
description: Escolhe um cClassTrib entre candidatos com probabilidade calibrada, usando o núcleo genérico (packages/classifier) com backend Jev (TypeSafe System One). Reutilizável em outros domínios trocando o pacote de candidatos.
---

# Classificador
- Ferramenta: `classificar {descricao, ncm, data}` (pipeline completo) ou o pacote `@auditor/classifier` (`classify(input, backend)`).
- Entrada mínima: `state = {descricao, ncm}`. Não envie outros dados do cliente.
- Saída: `choice`, `confidence`, `probabilities`. A escolha fora dos candidatos é rejeitada.
- Com um único candidato, nenhum modelo é chamado (decisão determinística).
- Calibração: use `calibrate(amostras, 0.99)` num conjunto de ouro revisado por contador para obter o limiar. Sem limiar, não há auto-certificação.
- Backends: `JevBackend` (padrão; requer `NODE_USE_ENV_PROXY=1` atrás de proxy) e `FakeBackend` (testes).
