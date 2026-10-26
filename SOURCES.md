# Fuentes, atribución y licencias

## Documento indexado

**«Consenso para el Diagnóstico y Tratamiento de la Enfermedad Tromboembólica Venosa»**
Sociedad Argentina de Cardiología (SAC), en colaboración con la Sociedad Argentina de Hematología (SAH). Área de Consensos y Normas de la SAC.
*Revista Argentina de Cardiología* 2025;93(Suplemento 6). 118 páginas.

| Campo | Valor |
|---|---|
| URL original | <https://www.sac.org.ar/wp-content/uploads/2025/04/COMPLETO-G.pdf> |
| Página de la revista donde se publica | <https://rac.sac.org.ar/index.php/rac/Suplementos> |
| Archivo en este repositorio | `data/protocols/sac_consenso_etv_2025.pdf` (renombrado; contenido idéntico) |
| SHA-256 | `b8fb8193e3ab3f9b64b3ec375f46359f46d849e09d7e75bba842aae122a6bd97` |
| Licencia | **Creative Commons Atribución-NoComercial-CompartirIgual 2.5 Argentina (CC BY-NC-SA 2.5 AR)** |

Esta es una herramienta independiente: la SAC y la SAH no han participado en ella ni la avalan.

## Licencia y cómo se cumple

La revista declara al pie de su página de suplementos, donde figura este consenso, que los trabajos publicados están bajo licencia **CC BY-NC-SA 2.5 Argentina** ([texto de la licencia](https://creativecommons.org/licenses/by-nc-sa/2.5/ar/)). La versión de la revista en [SciELO Argentina](https://www.scielo.org.ar/scielo.php?script=sci_serial&pid=1850-3748&lng=es&nrm=iso) declara además **CC BY-NC 4.0** para su contenido. El propio PDF no incluye una nota de licencia; se aplica la declarada por la revista.

| Condición | Cumplimiento en este proyecto |
|---|---|
| **Atribución (BY)** | Cada respuesta muestra documento, institución, año y página, con enlace al original. La interfaz, el README y este archivo atribuyen la autoría a la SAC y la SAH y enlazan la licencia. |
| **No comercial (NC)** | Demo personal de portfolio, sin publicidad, sin cobro y alojada en el plan Hobby de Vercel (uso no comercial). |
| **Compartir igual (SA)** | El PDF se redistribuye **sin modificar** (verificable con SHA-256). El índice `public/data/index.json` es una adaptación técnica (extractos literales por página, con cabeceras y bibliografía eliminadas, palabras cortadas reunidas y la clase de recomendación y el nivel de evidencia de cada tabla añadidos entre corchetes) y **se distribuye bajo la misma licencia CC BY-NC-SA 2.5 AR**. El código del proyecto, que no es obra derivada del documento, se publica con licencia MIT. |

**Material de terceros dentro del consenso.** Algunas tablas y figuras indican que están «tomadas y adaptadas» de otras publicaciones (por ejemplo, de las guías de la ESC). Forman parte del documento publicado y se reproducen tal cual, con su cita, dentro del PDF original.

**IA local opcional.** Cuando el visitante activa la IA local, el modelo redacta en su dispositivo una respuesta a partir de los extractos. Es una salida transitoria, no publicada ni almacenada, etiquetada como generada por IA y acompañada siempre de los extractos literales y sus referencias.

## Documentos evaluados y descartados

| Documento | Motivo |
|---|---|
| Procesos Asistenciales Integrados de la Junta de Andalucía (trauma grave 2020, EPOC 2015, ictus 2015, diabetes 2018), CC BY-NC-ND 4.0 | Usados en la primera versión. Sustituidos por su antigüedad: las respuestas no reflejaban la práctica actual. |
| 2026 AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN Guideline for the Evaluation and Management of Acute Pulmonary Embolism in Adults (*Circulation* 2026;153:e977–e1051) | © AHA y ACCF. El documento indica: _«Multiple copies, modification, alteration, enhancement, and distribution of this document are not permitted without the express permission of the American Heart Association.»_ Además está en inglés. No se publica. |
| Consenso multidisciplinar para el manejo de la tromboembolia de pulmón (*Arch Bronconeumol* 2022;58:246-54) | Lectura gratuita, pero «Copyright © SEPAR», sin licencia abierta. |

## Componentes de software de terceros

| Componente | Uso | Licencia |
|---|---|---|
| React, React DOM | Interfaz | MIT |
| MiniSearch | Búsqueda BM25 en el navegador | MIT |
| Tailwind CSS | Estilos (sólo en compilación) | MIT |
| Vite, TypeScript, Vitest | Compilación y pruebas | MIT / Apache-2.0 |
| @mlc-ai/web-llm | IA local opcional (WebGPU) | Apache-2.0 |
| Qwen2.5-1.5B-Instruct (MLC, q4f16_1) | Modelo de la IA local, descargado de Hugging Face sólo bajo petición | Apache-2.0 |
| PyMuPDF | Extracción de texto, **sólo en local** durante la preparación del índice; no se incluye en la aplicación ni se ejecuta en Vercel | AGPL-3.0 (o licencia comercial de Artifex) |
