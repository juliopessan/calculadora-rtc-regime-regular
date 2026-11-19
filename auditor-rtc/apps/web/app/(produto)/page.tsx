import Link from "next/link";
import { Icone } from "@/components/ledger-icons";
import { SimuladorMargem } from "./simulador-margem";

const PASSOS = [
  { t: "Envie o cadastro", d: "CSV exportado do ERP do cliente, com ';' e acentos, do jeito que o ERP gera." },
  { t: "Classificamos e verificamos", d: "Cada SKU recebe CST e cClassTrib entre as opções válidas e passa pelo motor de cálculo oficial." },
  { t: "Revise, assine e entregue", d: "Seu time vê só as exceções, o contador responsável assina e o cliente recebe o relatório com a marca do escritório." },
];

const PILARES = [
  { l: "C", r: "Classificador", t: "Escolhe entre opções válidas", d: "O modelo nunca inventa um código: escolhe entre os cClassTrib que as tabelas oficiais aceitam para aquele NCM." },
  { l: "V", r: "Verificador", t: "Confere no motor oficial", d: "Cada escolha roda na Calculadora de Tributos de código aberto da Receita Federal antes de chegar a você." },
  { l: "R", r: "Revisão", t: "Humano só na exceção", d: "Abaixo do limiar calibrado, o SKU vai para a fila do contador com as alternativas e o fundamento." },
];

export default function Landing() {
  return (
    <div className="wrap">
      <header className="mast reveal" style={{ ["--d" as string]: ".05s" }}>
        <Link className="brand" href="/" aria-label="Auditor RTC, início"><span className="brand__mark">A</span><span className="brand__name">Auditor RTC</span></Link>
        <nav className="mast__nav" aria-label="Principal"><a href="#como-funciona">Como funciona</a><a href="#preco">Preço</a><Link href="/login">Entrar</Link></nav>
        <span className="badge"><span className="dot dot--pulse" />Piloto</span>
      </header>

      <main id="conteudo">
        <section className="hero split">
          <div>
            <p className="eyebrow reveal" style={{ ["--d" as string]: ".05s" }}>Reforma Tributária do Consumo</p>
            <h1 className="display reveal" style={{ ["--d" as string]: ".16s" }} tabIndex={-1}>
              Revisão de cadastro para a Reforma Tributária, <i className="wipe">com a sua marca.</i>
            </h1>
            <p className="lede reveal" style={{ ["--d" as string]: ".27s" }}>
              Cada SKU classificado, verificado com o motor de cálculo de código aberto da Receita Federal e entregue com dossiê legal.
              No arroz ao lado, o motor aceita 85 classificações; o cenário de venda interna reduz a 10, e o modelo escolhe entre elas em 340 ms.
            </p>
            <div className="row reveal" style={{ ["--d" as string]: ".38s" }}>
              <Link className="btn" href="/cadastro">Quero um piloto</Link>
              <a className="link" href="#como-funciona">Como funciona <Icone nome="arrow-right" tamanho={16} /></a>
            </div>
          </div>
          <aside className="panel reveal" style={{ ["--d" as string]: ".3s" }} data-parallax="-0.05" data-tilt aria-label="Candidatos de classificação para o arroz">
            <div className="panel__head"><span className="dot dot--pulse" /><span className="title">Candidatos por NCM</span><span className="meta">arroz · 10063021</span></div>
            <div className="panel__body">
              <div className="bar bar--cost"><span className="bar__label">Válidos no motor oficial</span><span className="bar__val count" data-count="85">85</span><div className="bar__track"><span className="bar__fill" style={{ ["--w" as string]: "100%" }} /></div></div>
              <div className="bar bar--save"><span className="bar__label">Após o cenário de venda interna</span><span className="bar__val count" data-count="10">10</span><div className="bar__track"><span className="bar__fill" style={{ ["--w" as string]: "12%" }} /></div></div>
            </div>
            <div className="stats">
              <div><div className="stat__n count" data-count="88" data-suffix="%">88%</div><div className="stat__l">menos opções</div></div>
              <div><div className="stat__n">340 ms</div><div className="stat__l">por decisão</div></div>
            </div>
            <p className="note"><span className="flag" aria-hidden="true">✓</span><span>Medido em 18/11/2026 no motor oficial 1.6.1 e no Jev, para um produto. Não é uma média.</span></p>
            <div className="panel__foot"><span>medição única</span><span>sem dado de cliente</span></div>
          </aside>
        </section>

        <section className="section section--rule">
          <div className="stack" data-reveal><p className="eyebrow">O que é</p><h2 className="h2">Classifica, verifica, <i>e prova.</i></h2></div>
          <div className="cells cells--3" data-reveal-group style={{ marginTop: 40 }}>
            {PILARES.map((p) => (
              <div className="pillar" key={p.l}><span className="tile tile--ink">{p.l}</span><span className="pillar__role">{p.r}</span><h3 className="h3">{p.t}</h3><p className="soft">{p.d}</p></div>
            ))}
          </div>
        </section>

        <section className="section section--rule" id="como-funciona">
          <div className="stack" data-reveal><p className="eyebrow">Como funciona</p><h2 className="h2">Do arquivo do ERP <i>ao lote assinado.</i></h2></div>
          <div className="rail" data-reveal-group style={{ marginTop: 48 }}>
            {PASSOS.map((p, i) => (
              <div className="rail__step" key={p.t}><span className="rail__n">{i + 1}</span><h3 className="h3">{p.t}</h3><p className="soft">{p.d}</p></div>
            ))}
          </div>
        </section>

        <section className="section section--rule" id="preco">
          <div className="stack" data-reveal><p className="eyebrow">Preço e garantia</p><h2 className="h2">Cobrado por SKU certificado, <i>não por licença.</i></h2></div>
          <p className="lede" style={{ marginTop: 24 }}>Item pendente com o cliente ou fora do escopo não é cobrado. Se um SKU certificado causar rejeição por classificação, nós creditamos e reclassificamos.</p>
          <div style={{ marginTop: 32 }} data-reveal><SimuladorMargem /></div>
        </section>

        <section className="section section--rule">
          <div className="stack" data-reveal>
            <h2 className="h2">Seu escritório revisa o cadastro <i>sem revisar tudo.</i></h2>
            <div className="row" style={{ marginTop: 28 }}><Link className="btn" href="/cadastro">Quero um piloto</Link><Link className="link" href="/login">Já tenho conta <Icone nome="arrow-right" tamanho={16} /></Link></div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <span className="meta">Verificado com o motor de cálculo de código aberto da Receita Federal (licença MIT). O uso do motor não implica endosso da Receita Federal do Brasil. A classificação final é aprovada e assinada pelo contador responsável do seu escritório.</span>
        <nav aria-label="Rodapé"><Link href="/login">Entrar</Link><button className="icon-btn" type="button" data-theme-toggle aria-label="Tema: automático. Mudar tema"><Icone nome="contrast" /></button></nav>
      </footer>
    </div>
  );
}
