/** Documento fuente (metadatos generados por scripts/build_index.py). */
export interface DocMeta {
  id: string;
  title: string;
  shortTitle: string;
  institution: string;
  year: number;
  license: string;
  file: string;
  url: string;
  pages: number;
  contentPages: [number, number];
  keywords: string;
  sha256: string;
  chunks: number;
}

/** Fragmento indexado. Claves cortas para reducir el tamaño del índice. */
export interface Chunk {
  id: number;
  /** id del documento */
  d: string;
  /** página del PDF (1 = primera página del archivo) */
  p: number;
  /** número de página impreso en el documento, si se detectó */
  l: number | null;
  /** capítulo (pestaña de la cabecera) */
  c: string | null;
  /** etapa del proceso asistencial */
  s: string | null;
  /** página del glosario de acrónimos */
  g: boolean;
  /** texto literal del fragmento */
  t: string;
}

export interface IndexData {
  version: number;
  docs: DocMeta[];
  chunks: Chunk[];
}

export interface Source {
  /** número de referencia [n] en la respuesta */
  n: number;
  chunk: Chunk;
  doc: DocMeta;
  /** extracto breve y literal del fragmento */
  excerpt: string;
  score: number;
  coverage: number;
}

export type AnswerKind = "answer" | "insufficient" | "help";

export interface Answer {
  kind: AnswerKind;
  /** texto principal; en respuestas extractivas, frases literales con [n] */
  text: string;
  sources: Source[];
  /** las fuentes proceden de más de un protocolo */
  multiDoc: boolean;
  mode: "extractive" | "llm";
  ms: number;
}
