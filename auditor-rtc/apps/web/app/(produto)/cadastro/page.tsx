import "../../globals.css";
import Link from "next/link";
import { FormAuth } from "@/components/form-auth";

export default function CadastroPage() {
  return (
    <main className="container" style={{ maxWidth: 460, paddingTop: 64 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Cadastre seu escritório</h1>
        <p className="muted">Você entra como sócio e depois convida o contador responsável e os analistas.</p>
        <FormAuth
          endpoint="/api/auth/cadastro"
          botao="Criar conta"
          campos={[
            { nome: "escritorio", rotulo: "Nome do escritório" },
            { nome: "nome", rotulo: "Seu nome", autoComplete: "name" },
            { nome: "email", rotulo: "E-mail", tipo: "email", autoComplete: "email" },
            { nome: "senha", rotulo: "Senha (mínimo 10 caracteres)", tipo: "password", autoComplete: "new-password", minLength: 10 },
          ]}
        />
        <p className="muted" style={{ marginBottom: 0 }}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
