/**
 * Normalización de texto en español para indexar y consultar con la misma
 * función: minúsculas, sin tildes, sin palabras vacías y con un lematizador
 * ligero (singular/plural y género), suficiente para texto clínico.
 */

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aquel aquella aqui asi aun bajo bien cada " +
    "cierta cierto como con contra cual cuales cuando cuanto de del desde donde dos durante e el ella " +
    "ellas ello ellos en entre era es esa esas ese eso esos esta estan estas este esto estos fue fueron " +
    "ha habia han hasta hay la las le les lo los mas me mi mis mucho muy ni no nos o otra otras otro " +
    "otros para pero poco por porque puede pueden que quien se sea segun ser si sido sin sobre solo son " +
    "su sus tal tambien tanto te tiene tienen todo todos tras tu un una unas uno unos y ya " +
    // fórmulas de pregunta
    "cual cuales cuanto cuanta cuantos cuantas debe deben deberia hacer hace hago hacen quiero saber " +
    "dime explica explicame indica indicame informacion pregunta respecto acerca forma manera " +
    "existe existen recomienda recomiendan recomendacion recomendaciones protocolo protocolos documento " +
    "documentos segun pai proceso asistencial integrado paciente pacientes persona personas " +
    "significa significado sigla siglas acronimo acronimos abreviatura " +
    // verbos genéricos que no determinan el tema de la pregunta
    "colocar poner usar usa usan utilizar utiliza utilizan emplea emplean uso aplicar realizar realiza dar tomar necesita necesario conviene " +
    "recomendado recomendada recomendados recomendable aconseja aconsejable indicado indicada"
  ).split(" "),
);

/** Sinónimos y siglas frecuentes que se expanden en la consulta. */
const QUERY_SYNONYMS: Record<string, string[]> = {
  // Enfermedad tromboembólica venosa (siglas del consenso y términos coloquiales)
  tep: ["tromboembolia", "embolia", "tromboembolismo"],
  tromboembolia: ["tep", "tromboembolismo", "embolia"],
  tromboembolismo: ["tep", "tromboembolia", "embolia"],
  embolia: ["tep", "tromboembolia", "tromboembolismo"],
  embolismo: ["tep", "embolia"],
  tvp: ["trombosis"],
  etv: ["tromboembolica"],
  hbpm: ["heparina", "enoxaparina"],
  heparina: ["hbpm", "hnf"],
  enoxaparina: ["hbpm"],
  acod: ["anticoagulantes", "rivaroxaban", "apixaban", "edoxaban", "dabigatran"],
  avk: ["warfarina", "acenocumarol"],
  warfarina: ["avk"],
  acenocumarol: ["avk"],
  fvci: ["filtro"],
  filtro: ["fvci"],
  fibrinolisis: ["fibrinoliticos", "fibrinolitico", "trombolisis"],
  trombolisis: ["fibrinolisis", "fibrinoliticos", "fibrinolitico"],
  trombolitico: ["fibrinolitico", "fibrinolisis"],
  tomografia: ["angio", "tc"],
  tac: ["angio", "tc"],
  ecografia: ["doppler", "eco"],
  embarazada: ["embarazo", "embarazadas"],
  embarazadas: ["embarazo"],
  dimero: ["dimero"],
  ambulatorio: ["ambulatoria", "domiciliario"],
  domicilio: ["ambulatoria", "domiciliario"],
  pert: ["respuesta"],
  revertir: ["reversion", "reversor"],
  revierte: ["reversion", "reversor"],
  revierten: ["reversion", "reversor"],
  antidoto: ["reversor", "reversion"],
  xi: ["fxi", "xia"],
  // Equivalencias España ↔ Argentina (el consenso usa la terminología argentina)
  cribado: ["rastreo", "pesquisa"],
  screening: ["rastreo", "pesquisa"],
  gammagrafia: ["centellograma"],
  inr: ["rin"],
  ingreso: ["internacion", "hospitalizacion"],
  hospitalizar: ["internacion", "hospitalizacion"],
  ttpa: ["aptt"],
  sintrom: ["acenocumarol", "avk"],
  obeso: ["obesidad"],
  obesos: ["obesidad"],
  obesa: ["obesidad"],
  durar: ["duracion"],
  dura: ["duracion"],
  // Generales
  intravenosa: ["iv"],
  intravenoso: ["iv"],
  endovenosa: ["iv"],
  plazo: ["tiempo"],
  tension: ["presion"],
  hta: ["hipertension"],
  hipertension: ["hta"],
  azucar: ["glucemia"],
};

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/­/g, "");
}

export function stem(word: string): string {
  if (word.length <= 4 || /\d/.test(word)) return word;
  if (word.endsWith("ces")) return word.slice(0, -3) + "z";
  // Raíz común para verbo y sustantivo: confirmar / confirmación, anticoagular / anticoagulación.
  if (/aci(on|ones)$/.test(word) && word.length > 7) return word.replace(/aci(on|ones)$/, "");
  if (/[aei]r$/.test(word) && word.length > 6) return word.slice(0, -2);
  if (word.endsWith("iones")) return word.slice(0, -2);
  let w = word;
  if (/(os|as|es)$/.test(w) && w.length > 5) w = w.slice(0, -2);
  else if (/[oaes]$/.test(w)) w = w.slice(0, -1);
  return w;
}

/** Palabras normalizadas sin lematizar (para búsquedas de frases y resaltado). */
export function words(text: string): string[] {
  return fold(text)
    .replace(/\bi\.\s?v\./g, "iv")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 || /\d/.test(w));
}

/** Términos indexables: normalizados, sin palabras vacías y lematizados. */
export function tokenize(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Términos de una consulta agrupados: cada grupo contiene el término y sus
 * sinónimos; basta con que aparezca una alternativa del grupo.
 */
export function queryTerms(query: string): string[][] {
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const w of words(query)) {
    if (STOPWORDS.has(w)) continue;
    const alts = [...new Set([w, ...(QUERY_SYNONYMS[w] ?? [])].map(stem))].filter((t) => !seen.has(t));
    if (!alts.length) continue;
    alts.forEach((t) => seen.add(t));
    groups.push(alts);
  }
  return groups;
}
