-- Concessão (lease) do worker: um lote PROCESSANDO cujo worker morreu volta a ser reivindicável.
ALTER TABLE lotes ADD COLUMN reivindicado_em timestamptz;
