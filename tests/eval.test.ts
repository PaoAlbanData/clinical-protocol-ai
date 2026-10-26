import { readFileSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { INSUFFICIENT, ProtocolEngine } from "../src/lib/engine";
import type { IndexData } from "../src/lib/types";
import { ANSWERABLE, UNANSWERABLE } from "./cases";

const data: IndexData = JSON.parse(readFileSync("public/data/index.json", "utf-8"));
const engine = new ProtocolEngine(data);
const report: string[] = [];

describe("preguntas con respuesta en los protocolos", () => {
  for (const c of ANSWERABLE) {
    it(c.q, () => {
      const a = engine.ask(c.q);
      const pages = a.sources.map((s) => `${s.doc.id} p${s.chunk.p}`);
      const hit = a.sources.find((s) => s.doc.id === c.doc && c.pages.includes(s.chunk.p));
      const fact = a.sources.some((s) => s.chunk.t.includes(c.mustContain));
      report.push(`| ${c.q} | ${c.doc} p${c.pages.join("/")} | ${pages.join(", ") || "—"} | ${hit && fact ? "✅" : "❌"} |`);
      expect(a.kind).toBe("answer");
      expect(hit, `esperado ${c.doc} p${c.pages}, obtenido ${pages}`).toBeTruthy();
      expect(fact, `ninguna fuente contiene «${c.mustContain}»`).toBe(true);
    });
  }
});

describe("preguntas sin evidencia", () => {
  for (const q of UNANSWERABLE) {
    it(q, () => {
      const a = engine.ask(q);
      report.push(`| ${q} | rechazo | ${a.kind === "insufficient" ? "rechazada" : a.sources.map((s) => `${s.doc.id} p${s.chunk.p}`).join(", ")} | ${a.kind === "insufficient" ? "✅" : "❌"} |`);
      expect(a.kind).toBe("insufficient");
      expect(a.text).toBe(INSUFFICIENT);
      expect(a.sources).toHaveLength(0);
    });
  }
});

describe("integridad de las referencias", () => {
  it("cada fuente cita un documento, una página válida y un extracto literal", () => {
    for (const c of ANSWERABLE) {
      for (const s of engine.ask(c.q).sources) {
        expect(s.chunk.p).toBeGreaterThanOrEqual(1);
        expect(s.chunk.p).toBeLessThanOrEqual(s.doc.pages);
        const plain = s.excerpt.replace(/ …$/, "");
        expect(s.chunk.t.includes(plain.split("\n")[0])).toBe(true);
        expect(s.doc.institution).toMatch(/Sociedad Argentina de Cardiología/);
        expect(s.doc.year).toBeGreaterThan(2000);
      }
    }
  });

  it("los saludos devuelven ayuda, no una respuesta", () => {
    expect(engine.ask("hola").kind).toBe("help");
  });

  it("las consultas repetidas se sirven desde la caché", () => {
    const q = "tiempo puerta-aguja en el ictus";
    const first = engine.ask(q);
    expect(engine.ask("  Tiempo  PUERTA-AGUJA en el ictus ").sources).toEqual(first.sources);
  });
});

afterAll(() => {
  const ok = report.filter((r) => r.endsWith("✅ |")).length;
  writeFileSync(
    "tests/eval-report.md",
    [
      "# Informe de evaluación (generado por `npm test`)",
      "",
      `Fecha: ${new Date().toISOString().slice(0, 10)} · Aciertos: ${ok}/${report.length}`,
      "",
      "| Pregunta | Esperado | Fuentes recuperadas | Resultado |",
      "|---|---|---|---|",
      ...report,
      "",
    ].join("\n"),
  );
});
