---
name: verificador
description: Verifica uma classificação no motor oficial da Calculadora de Tributos (componente offline, MIT, Receita Federal) e interpreta códigos REG/CAL. Use sempre depois de classificar e antes de certificar.
---

# Verificador
- Ferramentas: `verificar_no_motor {ncm, cClassTrib, data}` e `explicar_erro_reg {codigo}`.
- `CALCULADO` ou `CALCULO_SIMULADO` = ok. A partir de 2027 o motor exige alíquotas nominais e o resultado é `CALCULO_SIMULADO` (válido para consistência).
- `INCONSISTENCIA_ENTRADA` com REG-xxx = escolha recusada; tente o próximo candidato.
- `NAO_IMPLEMENTADO` = `NAO_SUPORTADO` (não cobre, não chute). `FALHA_TECNICA` ou motor fora do ar = `ERRO_TEMPORARIO` (reprocessar).
- Base fixa de 100: a verificação checa o enquadramento, não o valor do imposto.
