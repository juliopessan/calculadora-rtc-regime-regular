-- Relatório público por token: resolve o escritório apenas de lotes concluídos.
CREATE OR REPLACE FUNCTION relatorio_por_token(p_token text)
RETURNS TABLE (escritorio_id uuid, lote_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.escritorio_id, l.id FROM lotes l
  WHERE l.token_relatorio = p_token AND l.status = 'CONCLUIDO'
$$;
REVOKE ALL ON FUNCTION relatorio_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relatorio_por_token(text) TO auditor_app;
