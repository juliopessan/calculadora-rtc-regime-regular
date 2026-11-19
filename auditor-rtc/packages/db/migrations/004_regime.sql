-- Regime do cliente do lote (registrado; não altera a classificação na v1.1).
ALTER TABLE lotes ADD COLUMN regime text NOT NULL DEFAULT 'regular' CHECK (regime IN ('regular', 'simples'));
