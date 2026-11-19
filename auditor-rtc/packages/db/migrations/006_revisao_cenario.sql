-- Revisão do cenário de classificação assinada pelo contador responsável de cada escritório.
CREATE TABLE revisoes_cenario (
  id bigserial PRIMARY KEY,
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  cenario_versao text NOT NULL,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  itens jsonb NOT NULL,
  sugeridos jsonb NOT NULL DEFAULT '[]',
  discordancias int NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE revisoes_cenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisoes_cenario FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisoes_cenario USING (escritorio_id = tenant_atual()) WITH CHECK (escritorio_id = tenant_atual());
GRANT SELECT, INSERT ON revisoes_cenario TO auditor_app;
GRANT USAGE ON SEQUENCE revisoes_cenario_id_seq TO auditor_app;
