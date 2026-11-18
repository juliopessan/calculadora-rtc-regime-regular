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
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
      <div className="card rolavel">
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Equipe</h1>
        <table className="tabela">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead>
          <tbody>{usuarios.map((u) => <tr key={u.id}><td>{u.nome}</td><td>{u.email}</td><td>{ROTULO_PAPEL[u.papel]}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Adicionar pessoa</h2>
        <p className="muted">Só o contador responsável pode concluir e assinar lotes.</p>
        <FormJson endpoint="/api/usuarios" botao="Adicionar" limparAoEnviar>
          <div className="campo"><label htmlFor="nome">Nome</label><input id="nome" name="nome" required /></div>
          <div className="campo"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required /></div>
          <div className="campo">
            <label htmlFor="papel">Papel</label>
            <select id="papel" name="papel" defaultValue="analista">
              <option value="analista">Analista</option>
              <option value="contador_responsavel">Contador responsável</option>
              <option value="socio">Sócio</option>
            </select>
          </div>
          <div className="campo"><label htmlFor="senha">Senha temporária (mínimo 10)</label><input id="senha" name="senha" type="text" minLength={10} required /></div>
        </FormJson>
      </div>
    </div>
  );
}
