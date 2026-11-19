import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";

// Usa o Playwright/Chromium já instalado no ambiente (não instalar outra versão).
const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const FIXTURE = fileURLToPath(new URL("./fixtures/cadastro-latin1.csv", import.meta.url));
const SHOTS = process.env.E2E_SCREENSHOTS;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 })).newPage();
});
afterAll(async () => browser?.close());

const shot = async (nome: string) => SHOTS && page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: true });

async function login(email: string, senha: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#senha", senha);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/app`);
}

describe("fluxo completo", () => {
  let loteUrl = "";

  it("shows the landing page", async () => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { level: 1 }).textContent()).resolves.toContain("Revisão de cadastro para a Reforma Tributária");
    await shot("01-landing");
  });

  it("signs up an office and uploads a Latin-1 cadastro", async () => {
    await page.goto(`${BASE}/cadastro`);
    await page.fill("#escritorio", "Contábil Horizonte");
    await page.fill("#nome", "Sofia Sócia");
    await page.fill("#email", "sofia@horizonte.com");
    await page.fill("#senha", "senha-da-sofia-123");
    await page.click("button[type=submit]");
    await page.waitForURL(`${BASE}/app`);

    await page.goto(`${BASE}/app/lotes/novo`);
    await page.fill("#cliente", "Mercado Bom Preço");
    await page.setInputFiles("#arquivo", FIXTURE);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/app\/lotes\/[0-9a-f-]{36}$/);
    loteUrl = page.url();
  });

  it("processes the lote with the real engine and opens the review queue", async () => {
    for (let i = 0; i < 60; i++) {
      await page.goto(loteUrl);
      if (await page.getByText("Processando o lote").count() === 0) break;
      await page.waitForTimeout(1000);
    }
    const corpo = await page.textContent("main");
    expect(corpo).toContain("Fila de revisão (3)");
    expect(corpo).toContain("Pendente com cliente");
    expect(corpo).toContain("NCM inválido");
    expect(corpo).toMatch(/Duplicados removidos\s*1/);
    expect(corpo).toContain("02013000"); // zero à esquerda recomposto
    expect(corpo).toMatch(/motor 1\.6\.1\/V\d+/);
    await shot("02-fila-de-revisao");
  });

  it("lets the sócio approve but not sign", async () => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /^Aprovar / }).first().click();
      await page.waitForFunction((n) => document.querySelectorAll("button").length > 0 && [...document.querySelectorAll("h2")].some((h) => h.textContent === `Fila de revisão (${n})`), 2 - i);
    }
    expect(await page.getByRole("button", { name: "Concluir e assinar lote" }).count()).toBe(0);
  });

  it("adds a contador responsável who signs the lote", async () => {
    await page.goto(`${BASE}/app/equipe`);
    await page.fill("#nome", "Carlos Contador");
    await page.fill("#email", "carlos@horizonte.com");
    await page.selectOption("#papel", "contador_responsavel");
    await page.fill("#senha", "senha-do-carlos-1");
    await page.click("button[type=submit]");
    await page.getByText("carlos@horizonte.com").waitFor();

    await page.context().clearCookies();
    await login("carlos@horizonte.com", "senha-do-carlos-1");
    await page.goto(loteUrl);
    await page.getByRole("button", { name: "Concluir e assinar lote" }).click();
    await page.getByRole("link", { name: "Relatório do cliente" }).waitFor();
    expect(await page.textContent("main")).toContain("Concluído e assinado");
  });

  it("serves the white-label report without our brand", async () => {
    const href = await page.getByRole("link", { name: "Relatório do cliente" }).getAttribute("href");
    await page.goto(`${BASE}${href}`);
    const corpo = (await page.textContent("body")) ?? "";
    expect(corpo).toContain("Contábil Horizonte");
    expect(corpo).toContain("Mercado Bom Preço");
    expect(corpo).toContain("Assinado por Carlos Contador");
    expect(corpo).not.toMatch(/Auditor RTC/i);
    await shot("03-relatorio-white-label");
  });

  it("exports the ERP CSV with the exact header", async () => {
    const res = await page.request.get(`${loteUrl.replace("/app/lotes/", "/api/lotes/")}/export`);
    expect(res.status()).toBe(200);
    const csv = await res.text();
    expect(csv.replace(/^﻿/, "").split("\r\n")[0]).toBe("codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao");
    expect(csv).toContain("CERTIFICADO_REVISADO");
  });

  it("blocks /app without a session", async () => {
    await page.context().clearCookies();
    await page.goto(`${BASE}/app`);
    expect(page.url()).toBe(`${BASE}/login`);
  });
});
