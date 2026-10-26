/**
 * Motor de consulta documental 100 % local: búsqueda BM25 (MiniSearch) sobre
 * el índice estático + verificación de cobertura + respuesta extractiva.
 *
 * Una respuesta sólo se emite si los fragmentos recuperados contienen los
 * términos relevantes de la pregunta (cobertura ponderada por IDF). Si no,
 * se devuelve el mensaje de información insuficiente. No hay texto generado:
 * cada frase de la respuesta es literal del PDF y lleva su referencia.
 */
import MiniSearch from "minisearch";
import type { Answer, Chunk, DocMeta, IndexData, Source } from "./types";
import { queryTerms, tokenize, words } from "./text";

const GREETINGS = new Set(["hola", "buenas", "buenos", "dias", "tardes", "noches", "gracias", "ayuda", "hey", "saludos"]);
const LEGEND_ENTRY = /\b[A-Z][A-Za-z0-9-]{1,9}\s?[:=]\s?[a-záéíóúñ]/g;
const INDICATOR_TEXT = /DENOMINACIÓN|FÓRMULA|POBLACIÓN DEL INDICADOR/;
const INDICATOR_QUERY = /\bindicador/;
const GLOSSARY_QUERY = /\b(significa|significado|sigla|siglas|acronimo|acronimos|abreviatura)\b/;

export const INSUFFICIENT =
  "No encuentro información suficiente en los protocolos incluidos para responder con seguridad.";

export const HELP =
  "Formule una pregunta general sobre el Consenso de Enfermedad Tromboembólica Venosa (TEP y TVP): diagnóstico, " +
  "estratificación del riesgo, anticoagulación, fibrinólisis, filtros de vena cava, poblaciones especiales… " +
  "Por ejemplo: «¿Qué pacientes con TEP pueden tratarse de forma ambulatoria?».";

/** Parámetros ajustados con el conjunto de evaluación de tests/eval.test.ts. */
export const CONFIG = {
  candidates: 30,
  maxSources: 3,
  minCoverage: 0.7,
  /** penalización de las páginas de acrónimos salvo que se pregunte por siglas */
  glossaryWeight: 0.35,
  /** penalización de las fichas de indicadores salvo que se pregunte por ellos */
  indicatorWeight: 0.5,
  /** bonificación máxima por términos de la pregunta contiguos en el texto */
  proximityBonus: 0.6,
  excerptChars: 420,
};

interface Prepared {
  chunk: Chunk;
  seq: string[];
  terms: Set<string>;
  indicator: boolean;
  doc: DocMeta;
  docTerms: Set<string>;
}

export class ProtocolEngine {
  readonly docs: DocMeta[];
  private byId = new Map<number, Prepared>();
  private df = new Map<string, number>();
  private docTerms: Map<string, Set<string>>;
  private n: number;
  private search: MiniSearch<{ id: number; t: string; k: string }>;
  private cache = new Map<string, Answer>();

  constructor(data: IndexData) {
    this.docs = data.docs;
    const docs = new Map(data.docs.map((d) => [d.id, d]));
    const docTerms = new Map(data.docs.map((d) => [d.id, new Set(tokenize(`${d.keywords} ${d.shortTitle}`))]));
    this.docTerms = docTerms;
    this.n = data.chunks.length;

    for (const chunk of data.chunks) {
      const seq = tokenize(chunk.t);
      const terms = new Set(seq);
      for (const t of terms) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.byId.set(chunk.id, {
        chunk,
        seq,
        terms,
        indicator: INDICATOR_TEXT.test(chunk.t),
        doc: docs.get(chunk.d)!,
        docTerms: docTerms.get(chunk.d)!,
      });
    }

    this.search = new MiniSearch({
      fields: ["t", "k"],
      tokenize: (text) => tokenize(text),
      processTerm: (term) => term,
      searchOptions: {
        boost: { t: 1, k: 0.8 },
        prefix: (term) => term.length >= 5,
        fuzzy: (term) => (term.length >= 7 ? 1 : false),
        combineWith: "OR",
      },
    });
    this.search.addAll(
      data.chunks.map((c) => {
        const d = docs.get(c.d)!;
        return { id: c.id, t: c.t, k: `${d.keywords} ${d.shortTitle} ${c.s ?? ""}` };
      }),
    );
  }

  idf(term: string): number {
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + this.n / (df + 0.5));
  }

  private weight(alts: string[]): number {
    return Math.min(...alts.map((t) => this.idf(t)));
  }

  /** ¿Aparece el término (o una variante cercana) en el fragmento o su documento? */
  private matches(term: string, p: Prepared): boolean {
    if (p.terms.has(term) || p.docTerms.has(term)) return true;
    if (term.length >= 5) {
      for (const t of p.terms) if (t.startsWith(term) || (term.startsWith(t) && t.length >= 5)) return true;
    }
    return false;
  }

  /**
   * Cobertura ponderada por IDF de los grupos de términos de la consulta en un
   * fragmento. Un término inexistente en el corpus tiene IDF máximo, por lo que
   * las preguntas sobre temas ausentes no alcanzan el umbral.
   */
  coverage(groups: string[][], p: Prepared): number {
    let total = 0;
    let hit = 0;
    for (const alts of groups) {
      const w = this.weight(alts);
      total += w;
      if (alts.some((t) => this.matches(t, p))) hit += w;
    }
    return total ? hit / total : 0;
  }

  /**
   * Fracción de pares consecutivos de la pregunta que aparecen juntos (a menos
   * de 3 posiciones) en el fragmento: favorece la expresión exacta.
   */
  proximity(groups: string[][], p: Prepared): number {
    if (groups.length < 2) return 0;
    const pos = groups.map((alts) => {
      const out: number[] = [];
      p.seq.forEach((t, i) => {
        if (alts.some((a) => t === a || (a.length >= 5 && t.startsWith(a)))) out.push(i);
      });
      return out;
    });
    let near = 0;
    for (let g = 0; g + 1 < pos.length; g++) {
      if (pos[g].some((i) => pos[g + 1].some((j) => Math.abs(j - i) <= 3))) near++;
    }
    return near / (groups.length - 1);
  }

  /** Extracto literal: las líneas del fragmento con más términos de la consulta. */
  excerpt(groups: string[][], chunk: Chunk): string {
    const terms = groups.flat();
    const lines = chunk.t.split("\n");
    const scored = lines.map((line, i) => {
      const lineTerms = new Set(tokenize(line));
      let s = 0;
      for (const t of terms) {
        if (lineTerms.has(t) || [...lineTerms].some((lt) => t.length >= 5 && lt.startsWith(t))) s += this.idf(t);
      }
      // Las leyendas de abreviaturas («HBPM: heparina…, HNF: …») no sirven como extracto.
      if ((line.match(LEGEND_ENTRY) ?? []).length >= 2 || (line.length < 120 && /^[A-Z][\w\-/]{1,12}\s?[:=]/.test(line))) s *= 0.2;
      return { i, s, len: line.length };
    });
    const best = [...scored].sort((a, b) => b.s - a.s || a.i - b.i)[0];
    if (!best || best.s === 0) return clip(chunk.t, CONFIG.excerptChars);

    // Ampliar alrededor de la mejor línea hasta el límite de caracteres.
    let from = best.i;
    let to = best.i;
    let len = best.len;
    // Si la línea anterior introduce una lista («...:»), incluirla.
    if (from > 0 && lines[from - 1].trim().endsWith(":") && len + lines[from - 1].length < CONFIG.excerptChars) {
      from--;
      len += lines[from].length;
    }
    while (to + 1 < lines.length && len + lines[to + 1].length < CONFIG.excerptChars) {
      to++;
      len += lines[to].length;
    }
    return clip(lines.slice(from, to + 1).join("\n"), CONFIG.excerptChars);
  }

  /** Recupera fragmentos verificados para la consulta (base de ambos modos). */
  retrieve(query: string): { terms: string[][]; sources: Source[] } {
    const terms = queryTerms(query);
    if (!terms.length) return { terms, sources: [] };

    // Si la pregunta nombra un protocolo («... en diabetes»), buscar sólo en él.
    const named = new Set(
      this.docs.filter((d) => terms.some((alts) => alts.some((t) => this.docTerms.get(d.id)!.has(t)))).map((d) => d.id),
    );
    const results = this.search
      .search(terms.flat().join(" "), named.size ? { filter: (r) => named.has(this.byId.get(r.id as number)!.doc.id) } : {})
      .slice(0, CONFIG.candidates);
    const q = words(query).join(" ");
    const wantsGlossary = GLOSSARY_QUERY.test(q);
    const wantsIndicators = INDICATOR_QUERY.test(q);
    const ranked = results
      .map((r) => {
        const p = this.byId.get(r.id as number)!;
        const cov = this.coverage(terms, p);
        let w = 1 + CONFIG.proximityBonus * this.proximity(terms, p);
        if (p.chunk.g) w *= wantsGlossary ? 1 / CONFIG.glossaryWeight : CONFIG.glossaryWeight;
        if (p.indicator && !wantsIndicators) w *= CONFIG.indicatorWeight;
        return { p, score: r.score, cov, rank: r.score * cov * cov * w };
      })
      .filter((r) => r.cov >= CONFIG.minCoverage)
      .sort((a, b) => b.rank - a.rank);

    // El término más específico de la pregunta debe aparecer en alguna fuente;
    // si no, la pregunta trata de algo que los protocolos no recogen.
    const top = terms.reduce((a, b) => (this.weight(b) > this.weight(a) ? b : a));
    const best = ranked.slice(0, CONFIG.maxSources * 2);
    if (!best.some((r) => top.some((t) => this.matches(t, r.p)))) return { terms, sources: [] };

    const sources: Source[] = [];
    const pages = new Set<string>();
    for (const r of ranked) {
      const key = `${r.p.doc.id}:${r.p.chunk.p}`;
      if (pages.has(key)) continue; // una referencia por página
      pages.add(key);
      sources.push({
        n: sources.length + 1,
        chunk: r.p.chunk,
        doc: r.p.doc,
        excerpt: this.excerpt(terms, r.p.chunk),
        score: r.score,
        coverage: r.cov,
      });
      if (sources.length >= CONFIG.maxSources) break;
    }
    return { terms, sources };
  }

  /** Respuesta extractiva con caché de consultas repetidas. */
  ask(query: string): Answer {
    const key = words(query).join(" ");
    const cached = this.cache.get(key);
    if (cached) return { ...cached, ms: 0 };

    const t0 = performance.now();
    const { terms, sources } = this.retrieve(query);
    let answer: Answer;
    if (!terms.length || words(query).every((w) => GREETINGS.has(w))) {
      answer = { kind: "help", text: HELP, sources: [], multiDoc: false, mode: "extractive", ms: 0 };
    } else if (!sources.length) {
      answer = { kind: "insufficient", text: INSUFFICIENT, sources: [], multiDoc: false, mode: "extractive", ms: 0 };
    } else {
      const multiDoc = new Set(sources.map((s) => s.doc.id)).size > 1;
      const text = sources.map((s) => `${s.excerpt.replace(/\n/g, " ")} [${s.n}]`).join("\n\n");
      answer = { kind: "answer", text, sources, multiDoc, mode: "extractive", ms: 0 };
    }
    answer.ms = Math.round(performance.now() - t0);
    this.cache.set(key, answer);
    return answer;
  }
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, "")) + " …";
}

/** Cita legible: «Consenso ETV (SAC 2025) — Sociedad Argentina de Cardiología…, 2025. Pág. 25 del PDF». */
export function citation(s: Source): string {
  const printed = s.chunk.l && s.chunk.l !== s.chunk.p ? ` (pág. impresa ${s.chunk.l})` : "";
  return `${s.doc.shortTitle} — ${s.doc.institution}, ${s.doc.year}. Pág. ${s.chunk.p} del PDF${printed}`;
}
