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
    <>
      <div className="page-head"><div className="stack"><h1 className="page-title" tabIndex={-1}>Marca do escritório</h1><p className="meta">Aparece só no relatório que o seu cliente recebe</p></div></div>
      <div className="block" style={{ maxWidth: 640 }}>
        <div className="block__body">
          <FormJson endpoint="/api/marca" botao="Salvar marca" feito="Marca salva">
            <div className="field"><label htmlFor="nome">Nome exibido</label><input className="input" id="nome" name="nome" defaultValue={e.nome} required /></div>
            <div className="field"><label htmlFor="corPrimaria">Cor principal</label><input className="input" id="corPrimaria" name="corPrimaria" type="color" defaultValue={e.corPrimaria} style={{ padding: 4 }} /></div>
            <div className="field"><label htmlFor="logoUrl">Endereço do logo</label><input className="input" id="logoUrl" name="logoUrl" type="url" inputMode="text" defaultValue={e.logoUrl ?? ""} placeholder="https://seuescritorio.com.br/logo.png" /><p className="hint">Precisa começar com https://.</p></div>
          </FormJson>
        </div>
      </div>
    </>
  );
}
