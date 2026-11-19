import { redirect } from "next/navigation";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { FormJson } from "@/components/form-json";

export default async function Marca() {
  const s = await sessaoOuLogin();
  if (s.papel !== "socio") redirect("/app");
  const e = await getDb().withTenant(s.escritorioId, (c) => repos.obterEscritorio(c));
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1 style={{ marginTop: 0, fontSize: 24 }}>Marca do escritório</h1>
      <p className="muted">É o que seu cliente vê no relatório. A nossa marca não aparece.</p>
      <FormJson endpoint="/api/marca" botao="Salvar marca">
        <div className="campo"><label htmlFor="nome">Nome exibido</label><input id="nome" name="nome" defaultValue={e.nome} required /></div>
        <div className="campo"><label htmlFor="corPrimaria">Cor principal</label><input id="corPrimaria" name="corPrimaria" type="color" defaultValue={e.corPrimaria} /></div>
        <div className="campo"><label htmlFor="logoUrl">Endereço do logo (https://)</label><input id="logoUrl" name="logoUrl" type="url" defaultValue={e.logoUrl ?? ""} /></div>
      </FormJson>
    </div>
  );
}
