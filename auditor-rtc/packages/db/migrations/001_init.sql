-- Auditor RTC — esquema inicial multi-tenant com RLS.
-- Roda como dona das tabelas. O app conecta como auditor_app (sujeito a RLS);
-- o worker conecta como auditor_worker (BYPASSRLS, só no processo do worker).

DO $$
BEGIN
  BEGIN
    CREATE ROLE auditor_app LOGIN PASSWORD 'auditor_app';
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  BEGIN
    CREATE ROLE auditor_worker LOGIN PASSWORD 'auditor_worker' BYPASSRLS;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION tenant_atual() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.escritorio_id', true), '')::uuid $$;

CREATE TABLE escritorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor_primaria text NOT NULL DEFAULT '#1f4e79' CHECK (cor_primaria ~ '^#[0-9a-fA-F]{6}$'),
  logo_url text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  email text NOT NULL,
  senha_hash text NOT NULL,
  nome text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('socio', 'contador_responsavel', 'analista')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_uq ON usuarios (lower(email));

CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  nome text NOT NULL,
  cnpj text,
  UNIQUE (escritorio_id, nome)
);

CREATE TABLE lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  status text NOT NULL DEFAULT 'NA_FILA' CHECK (status IN ('NA_FILA', 'PROCESSANDO', 'EM_REVISAO', 'CONCLUIDO')),
  data_referencia date NOT NULL,
  motor_versao text,
  threshold numeric CHECK (threshold IS NULL OR (threshold >= 0 AND threshold <= 1)),
  total int NOT NULL DEFAULT 0,
  duplicados int NOT NULL DEFAULT 0,
  token_relatorio text UNIQUE,
  concluido_por uuid REFERENCES usuarios(id),
  concluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lotes_status_idx ON lotes (status);

CREATE TABLE skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  lote_id uuid NOT NULL REFERENCES lotes(id),
  ordem int NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ncm_bruto text NOT NULL,
  ncm text,
  gtin text,
  status text NOT NULL DEFAULT 'NA_FILA' CHECK (status IN (
    'NA_FILA', 'CERTIFICADO_AUTO', 'CERTIFICADO_REVISADO', 'EM_REVISAO', 'PENDENTE_CLIENTE', 'NAO_SUPORTADO', 'ERRO_TEMPORARIO')),
  cst text,
  c_class_trib text,
  confianca numeric,
  probabilidades jsonb,
  candidatos jsonb,
  verificacao jsonb,
  motivo text,
  tentativas int NOT NULL DEFAULT 0,
  revisado_por uuid REFERENCES usuarios(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skus_lote_status_idx ON skus (lote_id, status);

CREATE TABLE eventos_auditoria (
  id bigserial PRIMARY KEY,
  escritorio_id uuid NOT NULL REFERENCES escritorios(id),
  lote_id uuid REFERENCES lotes(id),
  sku_id uuid REFERENCES skus(id),
  usuario_id uuid REFERENCES usuarios(id),
  tipo text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auditoria_somente_insercao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'eventos_auditoria aceita somente inserção';
END $$;
CREATE TRIGGER eventos_auditoria_imutavel BEFORE UPDATE OR DELETE ON eventos_auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_somente_insercao();

-- RLS: toda tabela de tenant só enxerga o escritório da transação corrente.
ALTER TABLE escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE escritorios FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON escritorios USING (id = tenant_atual()) WITH CHECK (id = tenant_atual());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios', 'clientes', 'lotes', 'skus', 'eventos_auditoria'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant ON %I USING (escritorio_id = tenant_atual()) WITH CHECK (escritorio_id = tenant_atual())', t);
  END LOOP;
END $$;

-- Login: busca por e-mail antes de conhecer o tenant. Só devolve o necessário.
CREATE OR REPLACE FUNCTION auth_buscar_usuario(p_email text)
RETURNS TABLE (id uuid, escritorio_id uuid, senha_hash text, nome text, papel text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.escritorio_id, u.senha_hash, u.nome, u.papel FROM usuarios u WHERE lower(u.email) = lower(p_email)
$$;

GRANT USAGE ON SCHEMA public TO auditor_app, auditor_worker;
GRANT SELECT, INSERT, UPDATE ON escritorios, usuarios, clientes, lotes, skus TO auditor_app, auditor_worker;
GRANT SELECT, INSERT ON eventos_auditoria TO auditor_app, auditor_worker;
GRANT USAGE ON SEQUENCE eventos_auditoria_id_seq TO auditor_app, auditor_worker;
REVOKE ALL ON FUNCTION auth_buscar_usuario(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_buscar_usuario(text) TO auditor_app;
GRANT EXECUTE ON FUNCTION tenant_atual() TO auditor_app, auditor_worker;
