---
name: candidatos
description: Gera o conjunto de cClassTrib legalmente possíveis para um NCM, a partir das tabelas do motor oficial e do cenário permitido. Use para restringir qualquer escolha de classificação.
---

# Candidatos válidos
- Ferramenta: `buscar_candidatos {ncm, data}`.
- Fonte: classificações do motor que valem para NF-e, filtradas pelo cenário `cenarios/venda-interna-v1.json` e validadas par a par (`ncm-aplicavel`).
- Atenção: o motor aceita **qualquer NCM** em classificações sem lista de NCMs (ex.: medicamentos, absorventes, livros). O motor **não** impede "cerveja como medicamento"; quem decide é a descrição. Por isso a revisão humana é obrigatória sem limiar calibrado.
- Código novo na tabela e fora do cenário: não entra como candidato e é sinalizado para revisão do cenário.
