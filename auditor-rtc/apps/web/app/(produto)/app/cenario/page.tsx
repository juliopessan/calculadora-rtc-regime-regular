import { repos } from "@auditor/db";
import { CENARIO_VENDA_INTERNA_V1, type Classificacao } from "@auditor/tax-pack";
import { getDb } from "@/lib/db";
import { getEngine } from "@/lib/engine";
import { sessaoOuLogin } from "@/lib/server-session";
import { FormRevisaoCenario, type LinhaCenario } from "@/components/form-revisao-cenario";
import { Icone } from "@/components/ledger-icons";

export const dynamic = "force-dynamic";

export default async function Cenario() {
  const s = await sessaoOuLogin();
  const cenario = CENARIO_VENDA_INTERNA_V1;
  const ultima = await getDb().withTenant(s.escritorioId, (c) => repos.ultimaRevisaoCenario(c, cenario.versao));

  let tabela: Classificacao[] = [];
  let motorOk = true;
  try {
    tabela = (await getEngine()?.classificacoes(new Date().toISOString().slice(0, 10))) ?? [];
    motorOk = tabela.length > 0;
  } catch {
    motorOk = false;
  }
  const porCodigo = new Map(tabela.map((c) => [c.codigo, c]));
  const permitidosSet = new Set(cenario.permitidos.map((p) => p.codigo));
  const permitidos: LinhaCenario[] = cenario.permitidos.map((p) => ({ codigo: p.codigo, motivo: p.motivo, descricao: porCodigo.get(p.codigo)?.descricao ?? p.motivo }));
  const excluidos: LinhaCenario[] = tabela
    .filter((c) => c.dfes.includes("NF-e") && !permitidosSet.has(c.codigo))
    .map((c) => ({ codigo: c.codigo, descricao: c.descricao, motivo: "" }));

  return (
    <>
      <div className="page-head">
        <div className="stack"><h1 className="page-title" tabIndex={-1}>Cenário de classificação</h1><p className="meta">{cenario.versao} · {cenario.permitidos.length} códigos permitidos para venda interna de mercadoria</p></div>
        <span className={ultima ? "badge badge--ok" : "badge badge--err"}>
          <Icone nome={ultima ? "success" : "warning"} />
          {ultima ? `Assinado por ${ultima.assinadoPor} em ${new Date(ultima.criadoEm).toLocaleDateString("pt-BR")}` : "Ainda não revisado"}
        </span>
      </div>
      <div className="block" style={{ marginBottom: 24 }}>
        <div className="block__body">
          <p style={{ margin: 0 }}>O classificador só escolhe entre os códigos abaixo. Revise se cada um depende só do produto; discordâncias e sugestões entram na próxima versão do cenário. Nada é bloqueado enquanto isso.</p>
          {ultima && <p className="hint" style={{ marginBottom: 0 }}>Última revisão: {ultima.discordancias} discordância(s), {ultima.sugeridos.length} sugestão(ões) de inclusão.</p>}
          {!motorOk && <p className="field-error" style={{ display: "flex", marginBottom: 0 }}><Icone nome="warning" tamanho={16} /><span>O motor oficial não respondeu; as descrições vêm do arquivo do cenário e a lista de excluídos não aparece.</span></p>}
        </div>
      </div>
      <FormRevisaoCenario permitidos={permitidos} excluidos={excluidos} podeAssinar={s.papel === "contador_responsavel"} />
    </>
  );
}
