/**
 * Conjunto de evaluación. Las páginas esperadas se obtuvieron del texto bruto
 * del PDF (PyMuPDF), no de la salida del buscador. `mustContain` es un dato
 * literal que debe figurar en alguna de las fuentes recuperadas.
 */
export interface AnswerableCase {
  q: string;
  doc: string;
  pages: number[];
  mustContain: string;
}

export const ANSWERABLE: AnswerableCase[] = [
  // Diagnóstico
  { q: "¿Cómo se evalúa la probabilidad clínica de TEP?", doc: "etv", pages: [15, 16, 17], mustContain: "Wells" },
  { q: "¿Cuándo se puede usar la regla PERC?", doc: "etv", pages: [15, 17], mustContain: "PERC" },
  { q: "¿Qué estudio de imagen se recomienda para confirmar un TEP?", doc: "etv", pages: [25], mustContain: "angio-TC" },
  { q: "¿Cuándo se puede usar el dímero-D ajustado por edad?", doc: "etv", pages: [22, 23], mustContain: "ajustado" },
  { q: "dímero-D en embarazadas con sospecha de TEP", doc: "etv", pages: [19, 20], mustContain: "embaraz" },
  { q: "¿Qué significa HTPTC?", doc: "etv", pages: [9], mustContain: "hipertensión pulmonar tromboembólica crónica" },
  // Estratificación y tratamiento
  { q: "¿Qué pacientes con TEP pueden tratarse de forma ambulatoria?", doc: "etv", pages: [40, 41], mustContain: "ambulatori" },
  { q: "fibrinolíticos sistémicos en TEP de alto riesgo", doc: "etv", pages: [52], mustContain: "fibrinolítico" },
  { q: "¿Cuándo está indicado un filtro de vena cava inferior?", doc: "etv", pages: [60], mustContain: "filtro" },
  { q: "¿Cómo se revierte el dabigatrán en un sangrado crítico?", doc: "etv", pages: [72], mustContain: "idarucizumab" },
  { q: "¿Se debe mantener la aspirina en pacientes anticoagulados por ETV?", doc: "etv", pages: [45], mustContain: "aspirina" },
  { q: "dosis de heparina no fraccionada en el tratamiento inicial", doc: "etv", pages: [43, 85], mustContain: "HNF" },
  { q: "trombo en tránsito", doc: "etv", pages: [37], mustContain: "corazón derecho" },
  { q: "medias de compresión en la trombosis venosa profunda", doc: "etv", pages: [41], mustContain: "medias de compresión" },
  // Poblaciones y situaciones especiales
  { q: "anticoagulación en pacientes con cáncer activo y ETV", doc: "etv", pages: [84, 85, 86, 87], mustContain: "cáncer" },
  { q: "¿Cuándo debemos sospechar un síndrome de May-Thurner?", doc: "etv", pages: [93], mustContain: "May-Thurner" },
  { q: "tratamiento de la trombosis venosa superficial", doc: "etv", pages: [108, 109, 110], mustContain: "superficial" },
  { q: "nuevos anticoagulantes inhibidores del factor XI", doc: "etv", pages: [112, 113], mustContain: "FXI" },
  { q: "grupos de respuesta rápida al embolismo de pulmón (PERT)", doc: "etv", pages: [114, 115, 116], mustContain: "PERT" },
  // Añadidas tras la ronda de preguntas no vistas: terminología de España frente a la argentina del consenso
  { q: "cribado de cáncer oculto tras una trombosis", doc: "etv", pages: [27], mustContain: "rastreo" },
  { q: "gammagrafía de ventilación perfusión en el diagnóstico de TEP", doc: "etv", pages: [25], mustContain: "centellograma" },
];

/** Preguntas sin evidencia en el consenso: deben rechazarse. */
export const UNANSWERABLE: string[] = [
  "¿Cuál es la dosis de amoxicilina en la otitis media?",
  "¿Cuál es el tratamiento de la migraña?",
  "dosis de insulina en la cetoacidosis diabética",
  "¿Cuál es el horario de visitas del hospital?",
  "vacuna antigripal en la EPOC",
  "tratamiento del asma bronquial",
  "protocolo de reanimación neonatal",
  "dosis de paracetamol en niños",
];
