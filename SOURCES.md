# Fuentes, atribución y licencias

## Documentos indexados

Procesos Asistenciales Integrados (PAI) publicados por la Consejería de Salud de la **Junta de Andalucía** y difundidos en el catálogo de **GuíaSalud**. Se usan exclusivamente como **material de simulación** para esta demostración; no representan protocolos hospitalarios vigentes ni validados.

| Documento | Editor | Año | Páginas | URL original | SHA-256 |
|---|---|---|---|---|---|
| Atención al trauma grave. Proceso Asistencial Integrado | Consejería de Salud y Familias, Junta de Andalucía | 2020 | 132 | [pai_atg_2020.pdf](https://portal.guiasalud.es/wp-content/uploads/2022/07/pai_atg_2020.pdf) | `4541ee2e…88ceedb` |
| Enfermedad Pulmonar Obstructiva Crónica (EPOC). PAI, 3.ª ed. | Consejería de Salud, Junta de Andalucía | 2015 | 80 | [pa_1_pai-epoc.pdf](https://portal.guiasalud.es/wp-content/uploads/2019/06/pa_1_pai-epoc.pdf) | `a11f9ee3…143be91` |
| Ictus. Proceso Asistencial Integrado | Consejería de Igualdad, Salud y Políticas Sociales, Junta de Andalucía | 2015 | 74 | [pa_2_pai-ictus.pdf](https://portal.guiasalud.es/wp-content/uploads/2019/06/pa_2_pai-ictus.pdf) | `d542151e…c8f45fa82` |
| Diabetes Mellitus. Proceso Asistencial Integrado | Consejería de Salud, Junta de Andalucía | 2018 | 99 | [pa_5_pai-diabetes_18_06_2018.pdf](https://portal.guiasalud.es/wp-content/uploads/2019/06/pa_5_pai-diabetes_18_06_2018.pdf) | `3babb051…cde104f` |

Los hashes completos están en [`data/protocols/checksums.json`](data/protocols/checksums.json). Editor y año se han tomado de la página de créditos de cada PDF.

## Licencia de los documentos: CC BY-NC-ND 4.0

La página de créditos de los cuatro PDF indica: _«Esta obra está bajo una licencia Creative Commons Reconocimiento-NoComercial-SinObraDerivada 4.0 Internacional»_ ([texto legal](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.es)).

Cómo se respetan sus condiciones:

| Condición | Cumplimiento en este proyecto |
|---|---|
| **Reconocimiento (BY)** | Cada respuesta muestra documento, institución, año y página, con enlace al original en GuíaSalud. La interfaz, el README y este archivo atribuyen la autoría a la Junta de Andalucía y enlazan la licencia. |
| **No comercial (NC)** | Demo personal de portfolio, sin publicidad, sin cobro y alojada en el plan Hobby de Vercel (uso no comercial). |
| **Sin obra derivada (ND)** | Los PDF se redistribuyen **sin modificar** (verificable con SHA-256). El buscador muestra **extractos literales** de partes de la obra, con su referencia, sin resumirlos, traducirlos ni reescribirlos; la licencia permite reproducir y compartir la obra «total o parcialmente». La única transformación es técnica: unir palabras cortadas por guiones de fin de línea, eliminar cabeceras de página repetidas y normalizar espacios. |
| **Sin respaldo** | La aplicación no sugiere que la Junta de Andalucía o GuíaSalud avalen este proyecto. |

**IA local opcional.** Cuando el visitante activa la IA local, el modelo redacta en su dispositivo una respuesta a partir de los extractos. Se trata de una salida transitoria, no publicada ni almacenada, etiquetada como generada por IA y acompañada siempre de los extractos literales y sus referencias. Si se quisiera reutilizar o publicar estos textos generados, debería revisarse su compatibilidad con la cláusula ND.

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
