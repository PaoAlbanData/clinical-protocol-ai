import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INSUFFICIENT, ProtocolEngine } from "../src/lib/engine";
import { sanitizeCitations, verifyGenerated } from "../src/lib/llm";
import type { IndexData } from "../src/lib/types";

const engine = new ProtocolEngine(JSON.parse(readFileSync("public/data/index.json", "utf-8")) as IndexData);
const dabigatran = engine.ask("¿Cómo se revierte el dabigatrán en un sangrado crítico?").sources;

describe("guardas de la IA local", () => {
  it("hay fuentes para la pregunta de referencia", () => {
    expect(dabigatran.length).toBeGreaterThan(0);
    expect(dabigatran.some((s) => s.chunk.t.includes("idarucizumab"))).toBe(true);
  });

  it("normaliza «el fragmento [1]» a «la fuente [1]» y elimina citas inexistentes", () => {
    expect(sanitizeCitations("Según el fragmento [1], se administran 5 g de idarucizumab.", dabigatran)).toBe(
      "Según la fuente [1], se administran 5 g de idarucizumab.",
    );
    expect(sanitizeCitations("Según el fragmento 2, x [9].", dabigatran)).toBe("Según la fuente [2], x .");
  });

  it("acepta una redacción correcta y citada", () => {
    const ok = sanitizeCitations(
      "Según el fragmento [1], en un sangrado crítico con dabigatrán se recomienda administrar 5 g de idarucizumab.",
      dabigatran,
    );
    expect(verifyGenerated(ok, dabigatran)).toBeNull();
  });

  it("rechaza afirmaciones sin cita (patrón real observado con Qwen2.5 1.5B)", () => {
    const fabricated =
      "El tratamiento del sangrado incluye:\n\n" +
      "- **Atención hospitalaria**: Se iniciará con atención hospitalaria inmediata.\n" +
      "- **Antiinflamatorios no esteroideos (AINE)**: Se administrarán antiinflamatorios como el ácido acetil salicílico.";
    expect(verifyGenerated(sanitizeCitations(fabricated, dabigatran), dabigatran)).toMatch(/sin referencia/);
  });

  it("rechaza cifras ausentes de las fuentes aunque estén citadas", () => {
    expect(verifyGenerated("Se administran 17 g de idarucizumab en 45 minutos [1].", dabigatran)).toMatch(/cifras/);
  });

  it("acepta el mensaje de información insuficiente", () => {
    expect(verifyGenerated(INSUFFICIENT, dabigatran)).toBeNull();
  });
});
