import Link from "next/link";
import { FormAuth } from "@/components/form-auth";
import { PainelAuth } from "@/components/painel-auth";

export default function CadastroPage() {
  return (
    <div className="auth">
      <main className="auth__form" id="conteudo">
        <Link className="brand" href="/" aria-label="Auditor RTC, início"><span className="brand__mark">A</span><span className="brand__name">Auditor RTC</span></Link>
        <div className="auth__box">
          <div className="stack">
            <h1 className="display" style={{ fontSize: "clamp(30px,4vw,40px)", letterSpacing: "-.03em" }} tabIndex={-1}>Cadastrar escritório</h1>
            <p className="soft">Você entra como sócio e depois adiciona o contador responsável e os analistas.</p>
          </div>
          <FormAuth
            endpoint="/api/auth/cadastro" botao="Criar conta" ocupado="Criando conta..."
            campos={[
              { nome: "escritorio", rotulo: "Nome do escritório" },
              { nome: "nome", rotulo: "Seu nome", autoComplete: "name" },
              { nome: "email", rotulo: "E-mail", tipo: "email", autoComplete: "email", inputMode: "email" },
              { nome: "senha", rotulo: "Senha", tipo: "password", autoComplete: "new-password", minLength: 10, dica: "Use pelo menos 10 caracteres." },
            ]}
          />
          <p className="row" style={{ fontSize: 14 }}><Link className="link" href="/login">Já tenho conta</Link></p>
        </div>
      </main>
      <PainelAuth />
    </div>
  );
}
