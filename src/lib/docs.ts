import manifest from "../../scripts/protocols.json";

/** Metadatos de los documentos (pequeños, incluidos en el bundle para la barra lateral). */
export const DOCUMENTS = manifest.map((d) => ({
  id: d.id,
  title: d.title,
  shortTitle: d.shortTitle,
  institution: d.institution,
  year: d.year,
  citation: d.citation,
  license: d.license,
  url: d.url,
  localUrl: `${import.meta.env.BASE_URL}protocols/${d.file}`,
}));

export function pdfLink(file: string, page: number): string {
  return `${import.meta.env.BASE_URL}protocols/${file}#page=${page}`;
}
