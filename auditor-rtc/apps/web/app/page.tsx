import Link from "next/link";
import s from "./landing.module.css";
import { SimuladorMargem } from "./simulador-margem";

const PASSOS = [
  { t: "Envie o cadastro", d: "Planilha exportada do ERP do cliente (CSV). Aceitamos o formato que o ERP gera, com ';' e acentos." },
  { t: "Classificamos e verificamos", d: "Cada SKU recebe CST e cClassTrib entre as opções válidas e é verificado no motor de cálculo oficial." },
  { t: "Você revisa as exceções e assina", d: "Seu time só olha o que ficou com dúvida. O contador responsável aprova e assina o lote." },
  { t: "Entregue com a sua marca", d: "Relatório com dossiê legal e arquivo pronto para importar no ERP, com o nome e as cores do seu escritório." },
];

export default function Landing() {
  return (
    <>
      <header className="container">
        <nav className={s.topo} aria-label="Principal">
          <Link href="/" className={s.marca}>Auditor RTC</Link>
          <Link href="/login" className="btn secundario">Entrar</Link>
        </nav>
      </header>
      <main className="container">
        <section className={s.hero}>
          <h1>Revisão de cadastro para a Reforma Tributária, com a sua marca.</h1>
          <p>
            Cada SKU classificado, verificado com o motor de cálculo de código aberto da Receita Federal e entregue com
            dossiê legal. Seu time só revisa as exceções.
          </p>
          <div className={s.ctas}>
            <Link href="/cadastro" className="btn">Quero um piloto</Link>
            <a href="#como-funciona" className="btn secundario">Como funciona</a>
          </div>
        </section>

        <section className={s.secao} id="como-funciona">
          <h2>Como funciona</h2>
          <ol className={s.passos}>
            {PASSOS.map((p, i) => (
              <li key={p.t}>
                <span className={s.num} aria-hidden>{i + 1}</span>
                <strong>{p.t}</strong>
                <span className="muted">{p.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.secao}>
          <h2>Garantia</h2>
          <p className={s.garantia}>
            Se um SKU certificado causar rejeição por classificação, nós creditamos e reclassificamos.
          </p>
        </section>

        <section className={s.secao}>
          <h2>Quanto seu escritório pode faturar</h2>
          <SimuladorMargem />
        </section>
      </main>
      <footer className={`container ${s.rodape}`}>
        Verificado com o motor de cálculo de código aberto da Receita Federal (licença MIT). O uso do motor não implica
        endosso da Receita Federal do Brasil a este produto. A classificação final é aprovada e assinada pelo contador
        responsável do seu escritório.
      </footer>
    </>
  );
}
