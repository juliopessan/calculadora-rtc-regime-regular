-- Escolha original do modelo (rótulo da calibração) e limiar do escritório.
ALTER TABLE skus ADD COLUMN escolha_modelo text, ADD COLUMN confianca_modelo numeric, ADD COLUMN backend_modelo text;
ALTER TABLE escritorios ADD COLUMN threshold numeric CHECK (threshold IS NULL OR (threshold >= 0 AND threshold <= 1));

CREATE TABLE calibracoes (
  id bigserial PRIMARY KEY,
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  amostras int NOT NULL,
  threshold numeric,
  precisao numeric,
  cobertura numeric,
  aplicado_por uuid NOT NULL REFERENCES usuarios(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE calibracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibracoes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON calibracoes USING (escritorio_id = tenant_atual()) WITH CHECK (escritorio_id = tenant_atual());
GRANT SELECT, INSERT ON calibracoes TO auditor_app, auditor_worker;
GRANT USAGE ON SEQUENCE calibracoes_id_seq TO auditor_app, auditor_worker;
