#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FakeBackend, JevBackend } from "@auditor/classifier";
import { EngineClient } from "@auditor/tax-pack";
import { criarServidor } from "./server.ts";

const engineUrl = process.env.ENGINE_URL;
if (!engineUrl) throw new Error("ENGINE_URL não definida");
const server = criarServidor({
  engine: new EngineClient({ baseUrl: engineUrl }),
  backend: process.env.CLASSIFIER_BACKEND === "fake" ? new FakeBackend() : new JevBackend(),
});
await server.connect(new StdioServerTransport());
