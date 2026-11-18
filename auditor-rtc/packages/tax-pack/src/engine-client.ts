/**
 * Cliente da Calculadora de Tributos oficial (componente offline, MIT, © Receita Federal do Brasil).
 * Rodamos o motor nós mesmos; ver auditor-rtc/engine/run-engine.sh.
 */

export type Classificacao = {
  codigo: string;
  /** CST = 3 primeiros dígitos do cClassTrib. */
  cst: string;
  descricao: string;
  nomenclatura: string;
  descricaoTratamentoTributario: string;
  /** Siglas dos DF-e em que a classificação vale, ex.: "NF-e", "NFC-e". */
  dfes: string[];
  possuiPercentualReducao: boolean;
};

export type ItemCalculo = { ncm: string; cst: string; cClassTrib: string; baseCalculo: number };

export type EstadoItem = "CALCULADO" | "CALCULO_SIMULADO" | "INCONSISTENCIA_ENTRADA" | "NAO_IMPLEMENTADO" | "FALHA_TECNICA";

export type ResultadoItem = {
  estadoItem: EstadoItem;
  erros: { code: string; detail: string }[];
  memoriaCalculo?: string;
};

export type Aliquotas = { cbs: number; ibsEstadual: number; ibsMunicipal: number };

/** Alíquotas nominais de referência usadas em docs/exemplos.md para fatos geradores a partir de 2027. */
export const ALIQUOTAS_PADRAO_2027: Aliquotas = { cbs: 8.8, ibsEstadual: 0.05, ibsMunicipal: 0.05 };

export class EngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

type ClassificacaoApi = Omit<Classificacao, "cst" | "dfes"> & { tiposDfeClassificacao?: { sigla: string }[] };

export class EngineClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly aliquotas: Aliquotas;

  constructor(opts: { baseUrl: string; fetchImpl?: typeof fetch; aliquotas?: Aliquotas }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.aliquotas = opts.aliquotas ?? ALIQUOTAS_PADRAO_2027;
  }

  async versao(): Promise<string> {
    const v = await this.getJson<{ versaoApp: string; versaoDb: string }>("/dados-abertos/versao");
    return `${v.versaoApp}/${v.versaoDb}`;
  }

  async ncmExiste(ncm: string, data: string): Promise<boolean> {
    const res = await this.request(`/dados-abertos/ncm?${qs({ ncm, data })}`);
    if (res.ok) return true;
    if (res.status >= 400 && res.status < 500) return false;
    throw new EngineUnavailableError(`motor respondeu HTTP ${res.status} em /ncm`);
  }

  async classificacoes(data: string): Promise<Classificacao[]> {
    const raw = await this.getJson<ClassificacaoApi[]>(`/dados-abertos/classificacoes-tributarias/cbs-ibs?${qs({ data })}`);
    return raw.map((c) => ({
      codigo: c.codigo,
      cst: c.codigo.slice(0, 3),
      descricao: c.descricao,
      nomenclatura: c.nomenclatura,
      descricaoTratamentoTributario: c.descricaoTratamentoTributario,
      dfes: (c.tiposDfeClassificacao ?? []).map((t) => t.sigla),
      possuiPercentualReducao: c.possuiPercentualReducao,
    }));
  }

  async ncmAplicavel(cClassTrib: string, ncm: string, data: string): Promise<boolean> {
    const r = await this.getJson<{ valido: boolean }>(
      `/dados-abertos/classificacoes-tributarias/ncm-aplicavel?${qs({ cClassTrib, ncm, dataOcorrenciaFatoGerador: data })}`,
    );
    return r.valido;
  }

  async calcularItem(item: ItemCalculo, data: string, municipio: number, uf: string): Promise<ResultadoItem> {
    const ano = Number(data.slice(0, 4));
    const body = {
      id: `verif-${item.ncm}-${item.cClassTrib}`,
      versao: "1.0.0",
      dhFatoGerador: `${data}T10:00:00-03:00`,
      municipio,
      uf,
      itens: [
        {
          numero: 1,
          ncm: item.ncm,
          cst: item.cst,
          cClassTrib: item.cClassTrib,
          baseCalculo: item.baseCalculo,
          quantidade: 1,
          unidade: "UN",
          ...(ano >= 2027 ? { aliquotasNominais: this.aliquotas } : {}),
        },
      ],
    };
    const res = await this.request("/observabilidade/regime-geral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new EngineUnavailableError(`motor respondeu HTTP ${res.status} no cálculo`);
    const json = (await res.json()) as { objetos?: ObjetoApi[] };
    const obj = json.objetos?.[0];
    if (!obj) throw new EngineUnavailableError("motor não devolveu o item calculado");
    return {
      estadoItem: obj.estadoItem,
      erros: (obj.erros ?? []).map((e) => ({ code: e.code, detail: e.detail })),
      memoriaCalculo: obj.tribCalc?.IBSCBS?.gIBSCBS?.gCBS?.memoriaCalculo,
    };
  }

  /** Descrição oficial de um código de erro da observabilidade (ex.: REG-011). */
  async descreverErro(codigo: string): Promise<{ codigo: string; titulo: string; descricao: string }> {
    if (!/^(REG|CAL)-\d{3}$/.test(codigo)) throw new Error("código de erro inválido");
    return this.getJson(`/observabilidade/erros?${qs({ codigo })}`);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.request(path);
    if (!res.ok) throw new EngineUnavailableError(`motor respondeu HTTP ${res.status} em ${path.split("?")[0]}`);
    return (await res.json()) as T;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, init);
    } catch (err) {
      throw new EngineUnavailableError(`motor inacessível: ${(err as Error).message}`);
    }
  }
}

type ObjetoApi = {
  estadoItem: EstadoItem;
  erros?: { code: string; detail: string }[];
  tribCalc?: { IBSCBS?: { gIBSCBS?: { gCBS?: { memoriaCalculo?: string } } } };
};

const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
