# Auditor RTC — perguntas para a validação jurídica do contrato

> Roteiro de perguntas para o advogado. **Não é parecer jurídico.** Serve para a reunião render respostas que viram cláusulas.
> Contexto do produto: `docs/superpowers/specs/2026-11-18-auditor-cadastro-rtc-design.md`.

## Como o serviço funciona (para o advogado)
- Vendemos, em white-label, a revisão do cadastro de mercadorias para IBS/CBS a **escritórios contábeis**. O escritório revende ao cliente final.
- Um modelo de IA escolhe o CST/cClassTrib **apenas entre opções válidas** das tabelas oficiais. Cada escolha é verificada no motor de cálculo de código aberto da Receita Federal (licença MIT).
- Abaixo de um limiar calibrado, um humano do escritório revisa. O **contador responsável do escritório aprova e assina** cada lote.
- Cobramos **por SKU certificado**, com garantia: SKU certificado que cause rejeição por classificação é creditado e reclassificado.

## 1. Responsabilidade técnica e enquadramento da atividade
1. A classificação fiscal de mercadorias, entregue como resultado e assinada por contador do escritório, é atividade privativa de contador? A nossa empresa precisa de registro no CRC, de responsável técnico próprio, ou basta o profissional do escritório?
2. Como posicionar o serviço (ferramenta, prestação de serviço técnico, terceirização ao escritório) para que a responsabilidade técnica fique com o profissional que assina, sem descaracterizar a venda por resultado?
3. Quando o lote é aprovado automaticamente (limiar calibrado, sem revisão item a item), a assinatura do lote pelo contador cobre esses itens? É preciso registro de que ele aprovou o limiar? (O produto já registra quem aplicou o limiar, quando e com quantas amostras.)

## 2. Garantia e limitação de responsabilidade
4. A garantia "crédito e reclassificação" pode ser o limite total da nossa responsabilidade? Como redigir para excluir multa, juros e autuação sofridos pelo cliente final?
5. Como tratar erros causados por dados de entrada (NCM errado informado pelo cliente, descrição genérica)? O produto marca esses itens como "pendente com cliente" e não os cobra.
6. A tabela cClassTrib e as notas técnicas mudam com frequência. A garantia vale para a versão da tabela usada no lote (registrada no dossiê) ou acompanha mudanças posteriores?
7. Há risco de responder como fornecedor perante o cliente final (CDC) mesmo sem contrato direto com ele (white-label)?

## 3. Cadeia contratual white-label
8. Que cláusulas devemos exigir do escritório no contrato com o cliente final (repasse de limitações, aviso de uso do motor oficial, ausência de endosso da Receita)?
9. O relatório não mostra a nossa marca. Isso afeta deveres de informação ao cliente final ou a validade das limitações?

## 4. Dados pessoais e sigilo (LGPD e sigilo profissional)
10. Somos operador ou controlador dos dados do cadastro? Quem é o controlador (escritório ou cliente final)?
11. Enviamos ao fornecedor do modelo (TypeSafe/Jev, servidores nos EUA) somente descrição do produto e NCM, sem CNPJ, preço ou dados de pessoas. Isso é transferência internacional de dados pessoais? Que base legal e cláusulas usar?
12. Retenção: por quanto tempo guardar o dossiê e a trilha de auditoria (que hoje não pode ser apagada) para servir de prova em fiscalização, e como isso convive com pedidos de eliminação?

## 5. Uso do motor oficial e marca
13. O motor é MIT (© Receita Federal do Brasil). Além de manter o aviso de licença, há restrição a uso comercial ou à frase "verificado com o motor de cálculo de código aberto da Receita Federal"?
14. Como evitar qualquer leitura de endosso oficial na publicidade?

## 6. Preço e tributação do próprio serviço
15. A cobrança por SKU certificado, com crédito por garantia, tem algum efeito no enquadramento do serviço para ISS/IBS/CBS que devamos prever no contrato?

## Documentos a levar
- Design do produto e fluxo de assinatura (spec v1 e v1.1).
- Exemplo de relatório white-label e de dossiê por SKU.
- Termos de uso e de dados do fornecedor do modelo (a obter).
