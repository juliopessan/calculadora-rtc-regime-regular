import Link from "next/link";
import { FormAuth } from "@/components/form-auth";
import { PainelAuth } from "@/components/painel-auth";

export default function LoginPage() {
  return (
    <div className="auth">
      <main className="auth__form" id="conteudo">
        <Link className="brand" href="/" aria-label="Auditor RTC, início"><span className="brand__mark">A</span><span className="brand__name">Auditor RTC</span></Link>
        <div className="auth__box">
          <div className="stack">
            <h1 className="display" style={{ fontSize: "clamp(30px,4vw,40px)", letterSpacing: "-.03em" }} tabIndex={-1}>Entrar</h1>
            <p className="soft">Use o e-mail do escritório.</p>
          </div>
          <FormAuth
            endpoint="/api/auth/login" botao="Entrar" ocupado="Verificando..."
            campos={[
              { nome: "email", rotulo: "E-mail", tipo: "email", autoComplete: "email", inputMode: "email" },
              { nome: "senha", rotulo: "Senha", tipo: "password", autoComplete: "current-password" },
            ]}
          />
          <p className="row" style={{ fontSize: 14 }}><Link className="link" href="/cadastro">Cadastrar meu escritório</Link></p>
        </div>
      </main>
      <PainelAuth />
    </div>
  );
}
