# Clinical Protocol AI

**Consulta documental de protocolos clínicos por texto o voz, con respuestas citadas y búsqueda 100 % en el navegador.**

> ⚠️ **Demostración técnica de portfolio.** No es un sistema autorizado de diagnóstico, prescripción ni apoyo a decisiones clínicas.
> Utiliza cuatro Procesos Asistenciales Integrados de la Junta de Andalucía (2015–2020) como **material de simulación**; pueden no reflejar la práctica actual.

- **Demo:** _pendiente de publicación en Vercel_
- **Coste de funcionamiento:** 0 € (ver [COSTS.md](COSTS.md))
- **Stack:** React · Vite · TypeScript · Tailwind CSS · MiniSearch (BM25) · PyMuPDF · WebLLM (opcional) · Web Speech API

---

## El problema

Los protocolos hospitalarios son PDF extensos (70–130 páginas) que se consultan bajo presión de tiempo. Un buscador de palabras clave devuelve demasiado ruido; un chatbot generalista puede **inventar** dosis, plazos o páginas. En un contexto clínico, una respuesta sin fuente verificable no es aceptable.

**Objetivo:** responder preguntas reales a partir de los documentos, mostrando siempre **documento, institución, año, página exacta del PDF y extracto literal**, y negarse a responder cuando la evidencia no es suficiente. Todo ello sin backend, sin APIs de pago y sin enviar las preguntas a ningún servidor.

## Qué hace

- Chat de preguntas escritas o **dictadas** (reconocimiento de voz del navegador) y botón para **escuchar** la respuesta.
- Respuesta **extractiva**: frases literales de los PDF, cada una con su referencia `[n]`.
- Cada fuente muestra documento, institución, año, **página del PDF** (y página impresa), extracto y botones para **abrir el PDF original en esa página** o en GuíaSalud.
- Si no hay evidencia: _«No encuentro información suficiente en los protocolos incluidos para responder con seguridad.»_
- Si las fuentes proceden de protocolos distintos, se avisa para que el usuario las compare.
- **IA local opcional** («Activar IA local»): un modelo de lenguaje (Qwen2.5 1.5B, ≈1 GB) se descarga bajo petición y redacta la respuesta **en el dispositivo** a partir de los fragmentos ya verificados.
- Copiar la respuesta con sus referencias. Interfaz en español, adaptada a móvil.

## Arquitectura

```
PREPARACIÓN (una vez, local, Python)                   CONSULTA (navegador del visitante, sin servidor)
─────────────────────────────────────                  ────────────────────────────────────────────────
GuíaSalud ──download_protocols.py──► data/protocols/   Pregunta (texto o voz)
                 │ SHA-256                               │ normalización: minúsculas, sin tildes,
                 ▼                                       │ palabras vacías, lematizador ligero, sinónimos
     validate_protocols.py (¿PDF legible?)               ▼
                 ▼                                     MiniSearch BM25 (+prefijos, +fuzzy) ── 30 candidatos
       build_index.py (PyMuPDF)                          ▼
   extracción ► limpieza ► fragmentos por página       Verificación de cobertura (IDF) ── ¿están los términos
                 ▼                                       │ relevantes en el fragmento? si no ► «No encuentro…»
     public/data/index.json  (630 KB / 174 KB gzip)     ▼
                 ▼                                     Reordenación: proximidad, penaliza glosario/indicadores
       verify_index.py: cada fragmento está en           ▼
       la página que cita (754/754)                    Respuesta extractiva + 3 fuentes con página
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
| **BM25 (MiniSearch) + verificación de cobertura** | La recuperación léxica permite **rechazar** con criterio: si el término más específico de la pregunta (mayor IDF) no aparece en ninguna fuente, no se responde. Una búsqueda semántica pura siempre devuelve «algo parecido». |
| **Sin embeddings** | Añadirían ≈100 MB de modelo y debilitarían el rechazo. No se han evaluado empíricamente; la mejora no es necesaria con el conjunto de pruebas actual. Es la principal línea de mejora (ver Limitaciones). |
| **Filtro por protocolo** | Si la pregunta nombra un protocolo («… en diabetes»), sólo se busca en él. Corrigió un error real detectado en las pruebas. |
| **Encabezado arrastrado** | Si un fragmento empieza a mitad de una actividad numerada («7.13 Hipoglucemia» + viñetas), repite el encabezado para no perder el contexto. |
| **WebLLM opcional en Web Worker** | IA generativa sin coste ni API: el modelo se ejecuta con WebGPU en el dispositivo del visitante y sólo se descarga si lo pide. Sólo redacta: la decisión de responder o no y las fuentes las fija el buscador. |
| **Guardas sobre la IA local** | La redacción **no se muestra mientras se genera**: sólo aparece si cada frase cita una fuente `[n]` y todas sus cifras figuran en las fuentes; si no, se descarta y se muestran los extractos. El glosario de siglas no se envía al modelo. Estas reglas nacieron de fallos reales observados en las pruebas (ver abajo). |
| **Carga diferida** | El índice (174 KB gzip) se descarga al enfocar el cuadro de pregunta; WebLLM (≈5,5 MB de código + modelo) sólo al activarlo. Carga inicial: ≈70 KB gzip. Caché en memoria para preguntas repetidas. |
| **PDF originales sin duplicar** | Un plugin de Vite sirve `data/protocols/` en `/protocols/` y lo copia a `dist/` sin modificar. |

## Estructura del repositorio

```
data/protocols/          PDF originales (sin modificar) + checksums.json
scripts/
  protocols.json         Manifiesto: título, institución, año, URL, licencia, páginas de contenido
  download_protocols.py  Descarga reproducible desde GuíaSalud (+ SHA-256)
  validate_protocols.py  Comprueba que cada PDF se abre y tiene texto extraíble
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

## Pruebas realizadas (resultados reales, 25/10/2026)

**Incorporación de documentos:** 4/4 PDF válidos, sin cifrar, con texto extraíble (132, 80, 74 y 99 páginas). Las 43 páginas sin texto son páginas en blanco o contraportadas (sin imágenes ni contenido), por lo que no se pierde información. No fue necesario OCR.

**Exactitud de páginas:** `verify_index.py` → **754/754 fragmentos** encontrados en la página del PDF que citan; SHA-256 coincidentes.

**Evaluación automatizada (`npm test`, 36 pruebas, todas superadas):**

- **20 preguntas con respuesta** (4–6 por protocolo): la página esperada está entre las 3 fuentes y alguna fuente contiene el dato literal (p. ej. «4,5 horas», «NIHSS ≥ 25», «1 g», «metformina»). Las páginas esperadas se obtuvieron del texto bruto del PDF, no de la salida del buscador.
- **8 preguntas sin evidencia** (amoxicilina en otitis, cáncer de mama, vacuna de la gripe en embarazadas, paracetamol en niños, migraña, horario de visitas, reanimación neonatal, neumonía por covid): todas rechazadas con el mensaje exacto.
- Integridad de referencias, saludos y caché.
- 5 pruebas de las guardas de la IA local con salidas reales del modelo (`tests/llm-guard.test.ts`).

Detalle por pregunta: [tests/eval-report.md](tests/eval-report.md).

**Honestidad metodológica.** El conjunto de pruebas se usó también para ajustar el motor, así que mide regresiones, no generalización. Para estimarla se lanzó una ronda de **14 preguntas nuevas** tras el ajuste inicial:
- 7 correctas (vía aérea en el politraumatizado, código ictus, antibióticos en la agudización de EPOC, código trauma, cetoacidosis, escala de Glasgow, cribado en el embarazo) y 1 aceptable pero imprecisa («tabaquismo y EPOC»: la primera fuente es texto de un diagrama).
- 2 rechazos razonables: «trombectomía mecánica» y «hora de oro» no aparecen en los documentos.
- **4 errores**: 2 corregidos y añadidos a las pruebas (falso rechazo en «escala para valorar la disnea»; «tensión arterial en diabetes» devolvía fragmentos de otros protocolos) y **2 sin resolver**: «tratamiento del infarto agudo de miocardio» devuelve menciones tangenciales del PAI de ictus en lugar de rechazar, y «¿cada cuánto hay que hacer la HbA1c?» recupera una fuente poco precisa.

**Navegador (build de producción con CSP activa):** escritorio 1280 px y móvil 375 px; preguntas por texto, ejemplos, rechazo, apertura de PDF (200, `application/pdf`, bytes idénticos al original), panel de documentos en móvil, **0 peticiones a dominios externos** y 0 errores de consola. Tiempos: construcción del índice ≈100 ms, consulta 1–10 ms.

**IA local (WebLLM) en el navegador integrado, con la CSP de producción:** el modelo (Qwen2.5 1.5B) se descargó desde Hugging Face sin violaciones de CSP en ≈20 s y después carga desde caché en 9–22 s; cada redacción tarda ≈30–50 s. Resultados reales:
- ✅ Ácido tranexámico: «1 gramo IV en 10 minutos, seguido de 1 gramo en 8 horas», citado y correcto. ✅ Diagnóstico de EPOC: espirometría forzada, citado.
- ⚠️ Fibrinolisis en el ictus: respondió sólo «menos de 60 minutos» (tiempo puerta-aguja) y omitió las 4,5 h desde el inicio de síntomas presentes en las fuentes 2 y 3. Es literal pero **incompleto**; por eso los extractos siempre se muestran debajo.
- ❌→✅ Infarto agudo de miocardio: en la primera versión el modelo **inventó un «tratamiento»** (AINE, antiagregantes) a partir del glosario de siglas, sin citas, y el texto se veía mientras se generaba. Se corrigió: no se muestra nada hasta verificarlo, toda frase debe citar una fuente y el glosario no se envía al modelo. Repetida la prueba, la redacción se descartó y sólo se mostraron los extractos. Esta salida real se conserva como prueba de regresión en `tests/llm-guard.test.ts`.

Conclusión: la IA local funciona y no tiene coste, pero un modelo de 1,5B es poco fiable para este uso. Se mantiene como opción experimental y desactivada por defecto; la respuesta extractiva es la principal.

**Pendiente de verificar:** dictado por voz con micrófono real; prueba en Vercel desde ventana de incógnito y en un móvil físico.

## Limitaciones conocidas

- **Recuperación léxica:** las paráfrasis sin palabras en común con el documento pueden no encontrarse («colocar» frente a «aplicar» se resolvió con sinónimos, pero la lista no es exhaustiva). Embeddings locales serían la siguiente mejora, evaluándolos contra este mismo conjunto.
- **Menciones tangenciales:** una pregunta sobre un tema ausente puede obtener fragmentos que sólo lo mencionan (p. ej. IAM como antecedente en el ictus). Los extractos visibles permiten detectarlo.
- **Contradicciones:** no se detectan automáticamente; sólo se avisa cuando las fuentes proceden de protocolos distintos.
- **Tablas complejas** (p. ej. fármacos de la diabetes) pierden su estructura al extraerse como texto.
- **Enlace a página (`#page=`)**: funciona en los visores de PDF de escritorio; algunos navegadores móviles lo ignoran.
- **IA local:** requiere WebGPU y ≈1,6 GB de memoria gráfica, tarda ≈30–50 s por respuesta y un modelo de 1,5B puede omitir información relevante (observado). Las guardas impiden mostrar frases sin cita o cifras ajenas a las fuentes, pero no garantizan que la redacción sea completa.
- **Documentos antiguos** (2015–2020), usados sólo como simulación.

## Adaptación futura a un entorno hospitalario autorizado

1. **Gobernanza documental:** protocolos vigentes aprobados por la comisión correspondiente, con versión, fecha de revisión y responsable; reindexación automática al publicar una versión nueva.
2. **Despliegue en la intranet** (el diseño estático lo facilita): sin datos fuera del hospital, con autenticación corporativa.
3. **Evaluación clínica formal:** conjunto de preguntas elaborado y validado por especialistas, métricas de recuperación y de rechazo, revisión periódica.
4. **Recuperación híbrida** (BM25 + embeddings ejecutados en servidores propios) y detección de contradicciones entre versiones.
5. **Cumplimiento normativo:** análisis de si el uso previsto lo convierte en producto sanitario (Reglamento (UE) 2017/745), evaluación de impacto de protección de datos (RGPD) y requisitos del Reglamento europeo de IA.
6. **Registro de auditoría** de consultas (sin datos de pacientes) para la mejora continua.

## Licencias

- **Código:** MIT ([LICENSE](LICENSE)).
- **Documentos:** © Junta de Andalucía, licencia CC BY-NC-ND 4.0, reproducidos sin modificaciones. Detalle en [SOURCES.md](SOURCES.md).
- Ver también [SECURITY.md](SECURITY.md), [COSTS.md](COSTS.md) y [DEPLOYMENT.md](DEPLOYMENT.md).
