# Clinical Protocol AI

**Consulta documental de una guía clínica por texto o voz, con respuestas citadas y búsqueda 100 % en el navegador.**

> ⚠️ **Demostración técnica de portfolio.** No es un sistema autorizado de diagnóstico, prescripción ni apoyo a decisiones clínicas.
> Consulta el *Consenso para el Diagnóstico y Tratamiento de la Enfermedad Tromboembólica Venosa* de la Sociedad Argentina de Cardiología (2025). Verifique siempre en el documento original y en los protocolos de su centro.

- **Demo:** <https://clinical-protocol-ai-kappa.vercel.app>
- **Coste de funcionamiento:** 0 € (ver [COSTS.md](COSTS.md))
- **Stack:** React · Vite · TypeScript · Tailwind CSS · MiniSearch (BM25) · PyMuPDF · WebLLM (opcional) · Web Speech API

---

## El problema

Las guías clínicas son PDF extensos (este tiene 118 páginas) que se consultan bajo presión de tiempo. Un buscador de palabras clave devuelve demasiado ruido; un chatbot generalista puede **inventar** dosis, plazos o páginas. En un contexto clínico, una respuesta sin fuente verificable no es aceptable.

**Objetivo:** responder preguntas reales a partir del documento, mostrando siempre **documento, institución, año, página exacta del PDF, extracto literal y, cuando existe, la clase de recomendación y el nivel de evidencia**, y negarse a responder cuando la evidencia no es suficiente. Todo ello sin backend, sin APIs de pago y sin enviar las preguntas a ningún servidor.

## Documento utilizado

**«Consenso para el Diagnóstico y Tratamiento de la Enfermedad Tromboembólica Venosa»**, Sociedad Argentina de Cardiología en colaboración con la Sociedad Argentina de Hematología. *Rev Argent Cardiol* 2025;93(Supl 6). Licencia **CC BY-NC-SA 2.5 Argentina**. Abarca tromboembolia de pulmón (TEP) y trombosis venosa profunda (TVP): diagnóstico, estratificación, anticoagulación, fibrinólisis y terapias por catéter, filtros de vena cava, seguimiento, duración del tratamiento, poblaciones especiales (cáncer, embarazo, insuficiencia renal, trombofilia), síndrome postrombótico, inhibidores del factor XI y equipos PERT.

**Por qué este documento.** La primera versión usaba cuatro Procesos Asistenciales de la Junta de Andalucía (2015–2020), demasiado antiguos para responder como la práctica actual. Se valoró la guía AHA/ACC 2026 de embolia pulmonar, pero su licencia prohíbe expresamente la distribución sin permiso y está en inglés; el consenso español de 2022 (SEPAR y otras sociedades) es de lectura gratuita pero sin licencia abierta. El consenso de la SAC es **en español, de 2025 y con licencia que permite publicarlo**. Detalle en [SOURCES.md](SOURCES.md).

## Qué hace

- Chat de preguntas escritas o **dictadas** (reconocimiento de voz del navegador) y botón para **escuchar** la respuesta.
- Respuesta **extractiva**: frases literales del PDF, cada una con su referencia `[n]`.
- Cada fuente muestra la sección del consenso, la **página del PDF** (y la página impresa), el extracto, la **clase de recomendación y el nivel de evidencia** como etiqueta, y botones para **abrir el PDF original en esa página** o en la web de la SAC.
- Si no hay evidencia: _«No encuentro información suficiente en los protocolos incluidos para responder con seguridad.»_
- **IA local opcional** («Activar IA local»): un modelo de lenguaje (Qwen2.5 1.5B, ≈1 GB) se descarga bajo petición y redacta la respuesta **en el dispositivo** a partir de los fragmentos ya verificados.
- Copiar la respuesta con sus referencias. Interfaz en español, adaptada a móvil.

## Arquitectura

```
PREPARACIÓN (una vez, local, Python)                   CONSULTA (navegador del visitante, sin servidor)
─────────────────────────────────────                  ────────────────────────────────────────────────
sac.org.ar ──download_protocols.py──► data/protocols/  Pregunta (texto o voz)
                 │ SHA-256                               │ normalización: minúsculas, sin tildes, palabras
                 ▼                                       │ vacías, lematizador ligero, sinónimos clínicos y
     validate_protocols.py (¿PDF legible?)               │ equivalencias España ↔ Argentina
                 ▼                                       ▼
       build_index.py (PyMuPDF, con coordenadas)       MiniSearch BM25 (+prefijos, +fuzzy) ── 30 candidatos
   cabeceras ► bibliografía ► párrafos ► clase/nivel     ▼
   por fila de tabla ► fragmentos por página           Verificación de cobertura (IDF) ── ¿están los términos
                 ▼                                       │ relevantes en el fragmento? si no ► «No encuentro…»
     public/data/index.json  (439 KB / 108 KB gzip)     ▼
                 ▼                                     Reordenación: proximidad de términos, glosario
       verify_index.py: cada fragmento está en           ▼
       la página que cita (481/481)                    Respuesta extractiva + 3 fuentes con página
                                                         ▼  (opcional)
                                                       WebLLM en Web Worker (WebGPU) redacta con [n];
                                                       sólo se muestra si cada frase cita y las cifras
                                                       están en las fuentes; si no, se descarta
```

Vercel sólo sirve archivos estáticos (`dist/`): no hay funciones serverless, base de datos ni claves.

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| **Sitio estático, sin backend** | Coste 0 € garantizado en Vercel Hobby, sin superficie de ataque de servidor y sin datos de visitantes en tránsito. |
| **Un fragmento = una página** | La cita de página es exacta por construcción. `verify_index.py` comprueba que el texto de cada fragmento aparece en la página citada del PDF original. |
| **Respuesta extractiva por defecto** | Elimina la posibilidad de inventar dosis o recomendaciones: todo lo que se muestra es texto literal del PDF. |
| **Bibliografía excluida** | El consenso intercala la bibliografía tras cada sección. Se detecta el encabezado «BIBLIOGRAFÍA» y se omite hasta la siguiente sección numerada, capítulo o párrafo en español; un filtro adicional descarta cualquier fragmento con varias referencias («et al.», DOI). |
| **Clase y nivel de evidencia por posición** | En las tablas del consenso el texto de las recomendaciones y las columnas «Clase» / «Nivel de evidencia» se extraen por separado. Se asignan por **coordenadas** (misma fila de la tabla) y sólo si hay exactamente una clase y un nivel; si no, se omiten antes que arriesgar una atribución errónea. |
| **BM25 (MiniSearch) + verificación de cobertura** | La recuperación léxica permite **rechazar** con criterio: si el término más específico de la pregunta (mayor IDF) no aparece en ninguna fuente, no se responde. Una búsqueda semántica pura siempre devuelve «algo parecido». |
| **Sinónimos y equivalencias España ↔ Argentina** | El consenso usa terminología argentina (rastreo, centellograma, RIN, internación). Un diccionario breve traduce los términos habituales en España (cribado, gammagrafía, INR, ingreso) y las siglas (TEP, TVP, HBPM, ACOD, AVK, FVCI). |
| **Sin embeddings** | Añadirían ≈100 MB de modelo y debilitarían el rechazo. No se han evaluado empíricamente; es la principal línea de mejora (ver Limitaciones). |
| **WebLLM opcional en Web Worker** | IA generativa sin coste ni API: el modelo se ejecuta con WebGPU en el dispositivo del visitante y sólo se descarga si lo pide. Sólo redacta: la decisión de responder o no y las fuentes las fija el buscador. |
| **Guardas sobre la IA local** | La redacción **no se muestra mientras se genera**: sólo aparece si cada frase cita una fuente `[n]` y todas sus cifras figuran en las fuentes; si no, se descarta y se muestran los extractos. El glosario de siglas no se envía al modelo. Estas reglas nacieron de fallos reales observados en las pruebas. |
| **Carga diferida** | El índice (108 KB gzip) se descarga al enfocar el cuadro de pregunta; WebLLM (≈5,5 MB de código + modelo) sólo al activarlo. Carga inicial: ≈70 KB gzip. Caché en memoria para preguntas repetidas. |
| **PDF original sin duplicar** | Un plugin de Vite sirve `data/protocols/` en `/protocols/` y lo copia a `dist/` sin modificar. |

## Estructura del repositorio

```
data/protocols/          PDF original (sin modificar) + checksums.json
scripts/
  protocols.json         Manifiesto: título, institución, año, URL, licencia, páginas, cabeceras
  download_protocols.py  Descarga reproducible desde la web de la SAC (+ SHA-256)
  validate_protocols.py  Comprueba que el PDF se abre y tiene texto extraíble
  build_index.py         PDF → limpieza → fragmentos por página → public/data/index.json
  verify_index.py        Verifica que cada fragmento está en la página que cita
public/data/index.json   Índice documental estático (reproducible)
src/lib/                 Motor de búsqueda, normalización, IA local, voz
src/components/          Interfaz
tests/                   Evaluación automatizada (vitest) + informe generado
```

## Uso local

Requisitos: Node.js 18+ y Python 3.10+ (Python sólo si quiere regenerar el índice).

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # evaluación automatizada → tests/eval-report.md
npm run build && npm run preview   # versión de producción con las cabeceras de vercel.json
```

Regenerar el índice desde cero:

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # en macOS/Linux: .venv/bin/pip
.venv/Scripts/python scripts/download_protocols.py
.venv/Scripts/python scripts/validate_protocols.py
.venv/Scripts/python scripts/build_index.py
.venv/Scripts/python scripts/verify_index.py
```

## Pruebas realizadas (resultados reales, 26/10/2026)

**Incorporación del documento:** PDF válido, sin cifrar, 118 páginas, todas con texto extraíble (no fue necesario OCR). Se indexan las páginas 9–118 (abreviaturas y contenido); 16 páginas compuestas sólo por bibliografía quedan excluidas.

**Exactitud de páginas:** `verify_index.py` → **481/481 fragmentos** encontrados en la página del PDF que citan; SHA-256 coincidente.

**Clase de recomendación y nivel de evidencia:** 219 recomendaciones con su clase y nivel asignados por coordenadas; 1 par de clase/nivel quedó sin asignar por ambigüedad. Comprobación semántica: las 15 recomendaciones de clase III son todas negativas («se desaconseja», «no se recomienda»), y ninguna recomendación negativa tiene otra clase.

**Errores detectados y corregidos durante el desarrollo** (se documentan porque muestran por qué hacen falta las verificaciones):
- La primera asignación de clases, por orden de aparición, atribuía clases equivocadas en tablas con varias recomendaciones (el PDF lista primero los textos y después las clases). Se sustituyó por la asignación por coordenadas.
- Párrafos de otra columna se unían al final de algunas recomendaciones. Se corrigió uniendo sólo líneas contiguas en la página.
- Un fallo de escritura de expresiones regulares (`\b`) desactivaba en la versión anterior el reconocimiento de «i.v.» y de las preguntas sobre siglas. Corregido.

**Evaluación automatizada (`npm test`, 38 pruebas, todas superadas):**

- **21 preguntas con respuesta** (diagnóstico, tratamiento, poblaciones especiales): la página esperada está entre las 3 fuentes y alguna fuente contiene el dato literal (p. ej. «Wells», «angio-TC», «idarucizumab», «centellograma»). Las páginas esperadas se obtuvieron del texto bruto del PDF, no de la salida del buscador.
- **8 preguntas sin evidencia** (amoxicilina en otitis, migraña, cetoacidosis, horario de visitas, vacuna antigripal en EPOC, asma, reanimación neonatal, paracetamol en niños): todas rechazadas con el mensaje exacto.
- Integridad de referencias, saludos y caché; 6 pruebas de las guardas de la IA local.

Detalle por pregunta: [tests/eval-report.md](tests/eval-report.md).

**Honestidad metodológica.** El conjunto de pruebas se usó también para ajustar el motor, así que mide regresiones, no generalización. Para estimarla se lanzó una ronda de **12 preguntas nuevas** tras el ajuste:
- 9 correctas a la primera (síndrome antifosfolipídico, insuficiencia renal, embarazo, embolectomía quirúrgica, ECMO, síndrome postrombótico, estratificación del riesgo, trombofilia, trombosis asociada a catéter).
- 3 falsos rechazos por **diferencias de vocabulario entre España y Argentina** («cribado» frente a «rastreo», «obesos» frente a «obesidad», «durar» frente a «duración»). Se añadieron equivalencias y las tres pasaron a responder; dos se incorporaron a las pruebas. La de duración del tratamiento responde con una fuente poco precisa (duración en pacientes con cáncer en lugar del capítulo general).

**Navegador y producción (26/10/2026):** build de producción con la CSP de `vercel.json`, en escritorio (1280 px) y móvil (375 px, sin desplazamiento horizontal) y en la URL pública de Vercel. Preguntas de diagnóstico, tratamiento y poblaciones especiales con las mismas páginas que en local, etiquetas de clase y nivel de evidencia visibles, rechazo con el mensaje exacto, PDF servido con el mismo tamaño que el original, **0 peticiones a dominios externos** y 0 cookies. La URL del índice incluye su huella (`index.json?v=…`) para que ningún navegador con caché combine la interfaz nueva con un índice antiguo.

**Pendiente de verificar:** dictado por voz con micrófono real y prueba en un móvil físico (los comprueba la autora manualmente).

## Limitaciones conocidas

- **Recuperación léxica:** las paráfrasis sin palabras en común con el documento pueden no encontrarse; el diccionario de sinónimos y equivalencias no es exhaustivo. Embeddings locales serían la siguiente mejora, evaluándolos contra este mismo conjunto.
- **Tablas y algoritmos gráficos** pierden su estructura al extraerse como texto; algunos diagramas (p. ej. el algoritmo de soporte del TEP de alto riesgo) se leen con el texto desordenado. Para esos casos, el botón «Abrir PDF en la pág. N» lleva a la figura original.
- **Clase y nivel de evidencia:** sólo se muestran cuando se identifican sin ambigüedad en la fila de la tabla.
- **Un solo documento:** las respuestas reflejan exclusivamente este consenso argentino; puede haber diferencias con guías de otros países o con los protocolos locales.
- **Enlace a página (`#page=`)**: funciona en los visores de PDF de escritorio; algunos navegadores móviles lo ignoran.
- **IA local:** requiere WebGPU y ≈1,6 GB de memoria gráfica, tarda ≈30–50 s por respuesta y un modelo de 1,5B puede omitir información relevante (observado). Las guardas impiden mostrar frases sin cita o cifras ajenas a las fuentes, pero no garantizan que la redacción sea completa.

## Adaptación futura a un entorno hospitalario autorizado

1. **Gobernanza documental:** protocolos vigentes aprobados por la comisión correspondiente, con versión, fecha de revisión y responsable; reindexación automática al publicar una versión nueva.
2. **Despliegue en la intranet** (el diseño estático lo facilita): sin datos fuera del hospital, con autenticación corporativa.
3. **Evaluación clínica formal:** conjunto de preguntas elaborado y validado por especialistas, métricas de recuperación y de rechazo, revisión periódica.
4. **Recuperación híbrida** (BM25 + embeddings ejecutados en servidores propios) y detección de contradicciones entre documentos o versiones.
5. **Cumplimiento normativo:** análisis de si el uso previsto lo convierte en producto sanitario (Reglamento (UE) 2017/745), evaluación de impacto de protección de datos (RGPD) y requisitos del Reglamento europeo de IA.
6. **Registro de auditoría** de consultas (sin datos de pacientes) para la mejora continua.

## Licencias

- **Código:** MIT ([LICENSE](LICENSE)).
- **Documento e índice derivado:** © Sociedad Argentina de Cardiología, licencia CC BY-NC-SA 2.5 Argentina. El PDF se reproduce sin modificaciones y el índice `public/data/index.json` se distribuye con la misma licencia. Detalle en [SOURCES.md](SOURCES.md).
- Ver también [SECURITY.md](SECURITY.md), [COSTS.md](COSTS.md) y [DEPLOYMENT.md](DEPLOYMENT.md).
