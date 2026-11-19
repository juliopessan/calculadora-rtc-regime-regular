import { redirect } from "next/navigation";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { ROTULO_PAPEL } from "@/lib/rotulos";
import { FormJson } from "@/components/form-json";

export default async function Equipe() {
  const s = await sessaoOuLogin();
  if (s.papel !== "socio") redirect("/app");
  const usuarios = await getDb().withTenant(s.escritorioId, (c) => repos.listarUsuarios(c));
  return (
    <>
      <div className="page-head"><div className="stack"><h1 className="page-title" tabIndex={-1}>Equipe</h1><p className="meta">Só o contador responsável conclui e assina lotes</p></div></div>
      <div className="gstack">
        <div className="block">
          <div className="block__head"><h2 className="h3">Pessoas</h2><span className="badge">{usuarios.length}</span></div>
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl"><thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th></tr></thead>
              <tbody>{usuarios.map((u) => <tr key={u.id}><td>{u.nome}</td><td className="mono">{u.email}</td><td><span className="badge">{ROTULO_PAPEL[u.papel]}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="block">
          <div className="block__head"><h2 className="h3">Adicionar pessoa</h2></div>
          <div className="block__body">
            <FormJson endpoint="/api/usuarios" botao="Adicionar pessoa" feito="Pessoa adicionada" limparAoEnviar>
              <div className="field"><label htmlFor="nome">Nome</label><input className="input" id="nome" name="nome" autoComplete="off" required /></div>
              <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} required /></div>
              <div className="field">
                <label htmlFor="papel">Papel</label>
                <select className="select input" id="papel" name="papel" defaultValue="analista">
                  <option value="analista">Analista</option>
                  <option value="contador_responsavel">Contador responsável</option>
                  <option value="socio">Sócio</option>
                </select>
              </div>
              <div className="field"><label htmlFor="senha">Senha temporária</label><input className="input" id="senha" name="senha" type="text" autoComplete="off" minLength={10} required /><p className="hint">Pelo menos 10 caracteres. Entregue por um canal seguro.</p></div>
            </FormJson>
          </div>
        </div>
      </div>
    </>
  );
}
