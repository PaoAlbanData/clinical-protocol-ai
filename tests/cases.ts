/**
 * Conjunto de evaluación. Las páginas esperadas se obtuvieron del texto bruto
 * de los PDF (PyMuPDF), no de la salida del buscador. `mustContain` es un dato
 * literal que debe figurar en alguna de las fuentes recuperadas.
 */
export interface AnswerableCase {
  q: string;
  doc: string;
  pages: number[];
  mustContain: string;
}

export const ANSWERABLE: AnswerableCase[] = [
  // Ictus (2015)
  { q: "¿Cuál es el plazo máximo desde el inicio de los síntomas para la fibrinólisis intravenosa en el ictus?", doc: "ictus", pages: [11, 28, 30], mustContain: "4,5 horas" },
  { q: "¿En cuánto tiempo debe estar realizado el TC de cráneo desde la llegada al hospital?", doc: "ictus", pages: [11, 30, 47], mustContain: "45 minutos" },
  { q: "tiempo puerta-aguja en el ictus", doc: "ictus", pages: [11, 29, 32], mustContain: "60 minutos" },
  { q: "¿Qué puntuación de la escala NIHSS contraindica la fibrinolisis?", doc: "ictus", pages: [30], mustContain: "NIHSS ≥ 25" },
  // Trauma grave (2020)
  { q: "¿Cuál es la dosis de ácido tranexámico en el trauma grave?", doc: "trauma", pages: [40, 65], mustContain: "1 g" },
  { q: "¿Cuándo se debe colocar un cinturón pélvico?", doc: "trauma", pages: [13, 40, 62], mustContain: "cinturón pélvico" },
  { q: "¿Se puede usar Ringer lactato en pacientes con TCE grave?", doc: "trauma", pages: [40, 70], mustContain: "Ringer" },
  { q: "indicaciones de intubación orotraqueal en el trauma", doc: "trauma", pages: [123], mustContain: "IOT" },
  // EPOC (2015)
  { q: "¿Cómo se confirma el diagnóstico de EPOC?", doc: "epoc", pages: [11, 19, 25], mustContain: "prueba broncodilatadora" },
  { q: "criterios de indicación de oxigenoterapia crónica domiciliaria", doc: "epoc", pages: [42], mustContain: "oxigenoterapia crónica domiciliaria" },
  { q: "¿Se recomienda la vacuna de la gripe en la EPOC?", doc: "epoc", pages: [34, 38], mustContain: "gripe" },
  { q: "¿A quién se debe ofrecer rehabilitación respiratoria?", doc: "epoc", pages: [11, 32, 33], mustContain: "rehabilitación respiratoria" },
  // Diabetes mellitus (2018)
  { q: "¿Cuál es el objetivo de HbA1c en adultos con diabetes?", doc: "diabetes", pages: [40, 66], mustContain: "HbA1c" },
  { q: "¿Cómo se realiza el cribado de retinopatía diabética?", doc: "diabetes", pages: [38], mustContain: "retinografía" },
  { q: "¿Qué hacer ante una hipoglucemia en un paciente inconsciente?", doc: "diabetes", pages: [55], mustContain: "glucagón" },
  { q: "¿Cuál es el primer fármaco recomendado en la diabetes tipo 2?", doc: "diabetes", pages: [13, 46], mustContain: "metformina" },
  { q: "cribado del pie diabético", doc: "diabetes", pages: [36, 52], mustContain: "pie diabético" },
  // Añadidas tras una primera ronda de preguntas no vistas (ver README, «Pruebas»)
  { q: "¿Qué escala se usa para valorar la disnea en la EPOC?", doc: "epoc", pages: [26], mustContain: "mMRC" },
  { q: "control de la tensión arterial en diabetes", doc: "diabetes", pages: [50], mustContain: "presión arterial" },
  { q: "criterios de activación del código trauma", doc: "trauma", pages: [48], mustContain: "código trauma" },
];

/** Preguntas sin evidencia en los cuatro protocolos: deben rechazarse. */
export const UNANSWERABLE: string[] = [
  "¿Cuál es la dosis de amoxicilina en la otitis media?",
  "tratamiento del cáncer de mama",
  "¿Qué vacuna de la gripe se recomienda en embarazadas?",
  "dosis de paracetamol en niños",
  "¿Cuál es el tratamiento de la migraña?",
  "¿Cuál es el horario de visitas del hospital?",
  "protocolo de reanimación neonatal",
  "¿Qué antibiótico se usa en la neumonía por covid?",
];
