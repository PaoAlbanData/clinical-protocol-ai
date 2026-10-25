import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INSUFFICIENT, ProtocolEngine } from "../src/lib/engine";
import { sanitizeCitations, verifyGenerated } from "../src/lib/llm";
import type { IndexData } from "../src/lib/types";

const engine = new ProtocolEngine(JSON.parse(readFileSync("public/data/index.json", "utf-8")) as IndexData);
const tranexamic = engine.ask("¿Cuál es la dosis de ácido tranexámico en el trauma grave?").sources;
const iam = engine.ask("¿Cuál es el tratamiento del infarto agudo de miocardio?").sources;

describe("guardas de la IA local (salidas reales de Qwen2.5 1.5B en el navegador)", () => {
  it("normaliza «el fragmento [1]» a «la fuente [1]» y elimina citas inexistentes", () => {
    expect(sanitizeCitations("Según el fragmento [1], la dosis es 1 g.", tranexamic)).toBe("Según la fuente [1], la dosis es 1 g.");
    expect(sanitizeCitations("Según el fragmento 2, x [9].", tranexamic)).toBe("Según la fuente [2], x .");
  });

  it("acepta una redacción correcta y citada", () => {
    const ok = sanitizeCitations(
      "Según el fragmento [1], la dosis de ácido tranexámico para el trauma grave es de 1g IV en 10 min, seguido de 1g en 8h.",
      tranexamic,
    );
    expect(verifyGenerated(ok, tranexamic)).toBeNull();
  });

  it("rechaza la «respuesta» inventada sobre el infarto agudo de miocardio", () => {
    const fabricated =
      "El tratamiento del infarto agudo de miocardio (IAM) incluye:\n\n" +
      "1. **Atención hospitalaria (AH)**: Se iniciará con atención hospitalaria inmediata.\n" +
      "2. **Antiinflamatorios no esteroideos (AINE)**: Se administrarán antiinflamatorios no esteroideos como el ácido acetil salicílico (ASAS) o el ácido salicílico (ASL).";
    expect(verifyGenerated(sanitizeCitations(fabricated, iam), iam)).toMatch(/sin referencia/);
  });

  it("rechaza cifras ausentes de las fuentes aunque estén citadas", () => {
    expect(verifyGenerated("Se administran 3 g de ácido tranexámico en 20 minutos [1].", tranexamic)).toMatch(/cifras/);
  });

  it("acepta el mensaje de información insuficiente", () => {
    expect(verifyGenerated(INSUFFICIENT, tranexamic)).toBeNull();
  });
});
