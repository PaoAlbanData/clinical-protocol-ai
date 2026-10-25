/**
 * IA generativa local y opcional (WebLLM + WebGPU). El modelo se descarga una
 * sola vez desde Hugging Face (archivos estáticos, sin API ni claves) y queda
 * en la caché del navegador. Nunca se usa para decidir SI hay respuesta: sólo
 * redacta a partir de fragmentos ya recuperados y verificados.
 */
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import { INSUFFICIENT } from "./engine";
import type { Source } from "./types";

export const LLM_MODEL = {
  id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  label: "Qwen2.5 1.5B Instruct (cuantizado 4 bits)",
  downloadMB: 1000,
  vramMB: 1630,
};

export type LlmStatus = "off" | "unsupported" | "loading" | "ready" | "error";

let engine: MLCEngineInterface | null = null;

export async function webGpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

export async function loadLlm(onProgress: (pct: number, text: string) => void): Promise<void> {
  if (engine) return;
  const webllm = await import("@mlc-ai/web-llm"); // el código de WebLLM sólo se descarga aquí
  const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" });
  engine = await webllm.CreateWebWorkerMLCEngine(worker, LLM_MODEL.id, {
    initProgressCallback: (r) => onProgress(Math.round(r.progress * 100), r.text),
  });
}

const SYSTEM = `Eres el asistente de una herramienta de consulta documental de protocolos clínicos (demostración).
Reglas obligatorias:
- Responde en español, en un máximo de 120 palabras.
- Usa EXCLUSIVAMENTE la información de los fragmentos numerados. No uses conocimientos propios.
- Cita cada afirmación con su número entre corchetes, por ejemplo [1]. No escribas "fragmento 1".
- Lee TODOS los fragmentos antes de responder. Si contienen varios plazos, cifras o criterios distintos, enuméralos todos indicando a qué se refiere cada uno; no elijas sólo uno.
- No añadas dosis, fármacos, cifras, plazos ni recomendaciones que no aparezcan literalmente en los fragmentos.
- Si los fragmentos no responden a la pregunta, responde exactamente: "${INSUFFICIENT}"
- Si fragmentos de protocolos distintos dicen cosas diferentes, indícalo citando ambos.
- No des consejos sobre pacientes concretos.`;

function prompt(question: string, sources: Source[]): string {
  const ctx = sources
    .map((s) => `[${s.n}] (${s.doc.shortTitle}, ${s.doc.year}, pág. ${s.chunk.p})\n${s.chunk.t}`)
    .join("\n\n");
  return `Fragmentos:\n${ctx}\n\nPregunta: ${question}`;
}

/** Números presentes en la respuesta generada que no figuran en las fuentes. */
export function unsupportedNumbers(text: string, sources: Source[]): string[] {
  const corpus = sources.map((s) => s.chunk.t).join(" ").replace(/\s+/g, " ");
  const nums = text.replace(/\[\d+\]/g, "").match(/\d+(?:[.,]\d+)?/g) ?? [];
  return [...new Set(nums)].filter((n) => !corpus.includes(n));
}

/**
 * Normaliza «fragmento 1» / «el fragmento [1]» a «la fuente [1]» y elimina referencias [n] que no corresponden
 * a ninguna fuente.
 */
export function sanitizeCitations(text: string, sources: Source[]): string {
  return text
    .replace(/\(?fragmentos? \[?(\d+)\]?\)?/gi, "[$1]")
    .replace(/según (?:el|los) \[/gi, "Según la fuente [")
    .replace(/(?:el|los) \[/gi, "la fuente [")
    .replace(/\[(\d+)\]/g, (m, n) => (sources.some((s) => s.n === Number(n)) ? m : ""));
}

/**
 * Verificación de la redacción generada. Devuelve el motivo de rechazo o null.
 * - Toda frase o elemento de lista debe citar una fuente [n].
 * - Toda cifra debe figurar en las fuentes.
 */
export function verifyGenerated(text: string, sources: Source[]): string | null {
  if (!text.trim()) return "La IA local no produjo texto.";
  if (text.includes(INSUFFICIENT.slice(0, 40))) return null;
  const bad = unsupportedNumbers(text, sources);
  if (bad.length) return `Incluía cifras que no figuran en las fuentes (${bad.join(", ")}).`;
  const segments = text
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿•\-*\d])/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[^a-záéíóúñ]/gi, "").length >= 25 && !/:$/.test(s));
  const uncited = segments.filter((s) => !/\[\d+\]/.test(s));
  if (uncited.length) return `Contenía afirmaciones sin referencia a las fuentes («${uncited[0].slice(0, 60)}…»).`;
  return null;
}

export async function generate(question: string, all: Source[], onToken: (text: string) => void): Promise<string> {
  if (!engine) throw new Error("IA local no cargada");
  // El glosario de siglas induce asociaciones falsas en el modelo: no se le envía.
  const sources = all.filter((s) => !s.chunk.g);
  if (!sources.length) return INSUFFICIENT;
  const stream = await engine.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt(question, sources) },
    ],
    temperature: 0.1,
    max_tokens: 320,
    stream: true,
  });
  let text = "";
  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? "";
    onToken(text);
  }
  return sanitizeCitations(text.trim(), sources);
}
