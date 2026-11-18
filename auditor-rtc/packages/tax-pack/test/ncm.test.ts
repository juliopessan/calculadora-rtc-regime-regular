import { describe, it, expect } from "vitest";
import { normalizarNcm } from "../src/index.ts";

describe("normalizarNcm", () => {
  it("removes dots", () => expect(normalizarNcm("1006.30.21")).toBe("10063021"));
  it("restores the leading zero Excel dropped", () => expect(normalizarNcm("2013000")).toBe("02013000"));
  it("trims spaces", () => expect(normalizarNcm(" 10063021 ")).toBe("10063021"));
  it("rejects too short", () => expect(normalizarNcm("123")).toBeNull());
  it("rejects too long", () => expect(normalizarNcm("123456789")).toBeNull());
  it("rejects empty", () => expect(normalizarNcm("")).toBeNull());
});
