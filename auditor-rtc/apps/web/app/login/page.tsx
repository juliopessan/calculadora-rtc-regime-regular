import Link from "next/link";
import { FormAuth } from "@/components/form-auth";

export default function LoginPage() {
  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 64 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Entrar</h1>
        <FormAuth
          endpoint="/api/auth/login"
          botao="Entrar"
          campos={[
            { nome: "email", rotulo: "E-mail", tipo: "email", autoComplete: "email" },
            { nome: "senha", rotulo: "Senha", tipo: "password", autoComplete: "current-password" },
          ]}
        />
        <p className="muted" style={{ marginBottom: 0 }}>
          Ainda não tem conta? <Link href="/cadastro">Cadastre seu escritório</Link>
        </p>
      </div>
    </main>
  );
}
