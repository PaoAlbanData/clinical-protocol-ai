# Auditoría de costes

**Presupuesto de funcionamiento: 0 €. Coste real previsto: 0 €.**

## Inventario de servicios

| Componente | Proveedor | Plan | ¿Facturación variable? | Coste |
|---|---|---|---|---|
| Hosting estático (`dist/`) | Vercel | Hobby (gratuito, uso personal no comercial) | No: Hobby no admite pago por exceso; si se alcanzan los límites, Vercel limita o pausa el proyecto, no cobra | 0 € |
| Repositorio | GitHub | Gratuito | No | 0 € |
| Búsqueda y respuestas | Navegador del visitante (MiniSearch) | — | No hay servidor | 0 € |
| IA local opcional | Navegador del visitante (WebLLM + WebGPU) | — | No hay API; el modelo se descarga de Hugging Face como archivo estático público | 0 € |
| Voz | Web Speech API del navegador | — | No: lo proporciona el navegador; no hay claves ni contrato | 0 € |
| Preparación del índice | Python + PyMuPDF en el ordenador de la autora | — | No | 0 € |

**No se usa:** ninguna API de IA de pago, clave facturable, base de datos en la nube, función serverless, servicio de telefonía, analítica, CDN externo ni periodo de prueba.

Comprobaciones en el código:
- No hay variables de entorno ni claves (`grep -ri "api_key\|apikey\|secret" src scripts` → sin resultados).
- No hay carpeta `api/` ni funciones serverless: Vercel sólo sirve archivos estáticos.
- En la prueba en navegador, la aplicación realizó **0 peticiones a dominios externos** durante las consultas. Las únicas conexiones externas posibles son: la descarga del modelo (sólo si el visitante pulsa «Activar IA local») y los enlaces que el visitante abre (GuíaSalud).
- Las preguntas de los visitantes **no consumen tokens de Claude** ni de ningún otro proveedor: se responden con el índice estático.

## Consumo estimado por visita (transferencia desde Vercel)

| Recurso | Tamaño (gzip) | Cuándo se descarga |
|---|---|---|
| HTML + JS + CSS iniciales | ≈70 KB | Al abrir la página |
| Índice documental `index.json` | ≈174 KB | Al enfocar el cuadro de pregunta (una vez; caché HTTP 1 h) |
| Código de WebLLM | ≈2 MB | Sólo al activar la IA local |
| Cada PDF original | 0,7–1,3 MB | Sólo al pulsar «Abrir PDF» (caché 24 h) |
| Modelo de IA (≈1 GB) | — | **Desde Hugging Face, no desde Vercel**; sólo bajo petición |

Una visita típica (abrir, preguntar, abrir un PDF) transfiere ≈1,5 MB. Como orientación, con una cuota mensual de transferencia de 100 GB harían falta del orden de **60.000 visitas al mes** para agotarla. Consulte los límites vigentes del plan Hobby en <https://vercel.com/docs/limits> antes de publicar; si se alcanzan, Vercel pausa el proyecto hasta el siguiente ciclo, sin cargos.

## Riesgos y controles

| Riesgo | Control |
|---|---|
| Activar sin querer un plan de pago en Vercel | No añadir método de pago; no aceptar «Pro trial». La publicación se hace sólo con autorización expresa. |
| Uso comercial (incompatible con Hobby y con CC BY-NC) | Demo personal de portfolio, sin anuncios ni cobro. |
| Tráfico inesperado | Sin funciones serverless, sólo archivos estáticos cacheables; en el peor caso, pausa del proyecto, nunca coste. |
