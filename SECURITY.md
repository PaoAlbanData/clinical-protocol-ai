# Seguridad, privacidad y limitaciones de uso

## Uso previsto

Clinical Protocol AI es una **herramienta de consulta documental de demostración**. **No** es:

- un sistema autorizado de diagnóstico, prescripción o apoyo a decisiones clínicas individuales;
- un producto sanitario ni ha sido evaluado como tal;
- un sustituto del documento original ni de los protocolos de cada centro: consulta un único consenso (Sociedad Argentina de Cardiología, 2025) y sus respuestas son extractos que deben verificarse en el PDF.

Ante cualquier decisión asistencial, consulte los protocolos vigentes de su centro y el criterio de profesionales cualificados.

## Garantías de fiabilidad implementadas

- Las respuestas por defecto son **extractos literales** del PDF con documento y página; no hay texto generado.
- Cada fragmento pertenece a una única página; `scripts/verify_index.py` comprueba que su texto está en la página citada.
- Si los términos relevantes de la pregunta no aparecen en las fuentes, la aplicación responde: _«No encuentro información suficiente en los protocolos incluidos para responder con seguridad.»_
- La IA local opcional sólo redacta a partir de fragmentos ya verificados (sin el glosario de siglas). Su texto **no se muestra durante la generación**: sólo aparece si cada frase cita una fuente `[n]` existente y todas sus cifras figuran en las fuentes; en caso contrario se descarta. Aun así puede omitir información (observado en las pruebas): siempre se muestra etiquetada y junto a los extractos originales.

## Privacidad

- **No se solicitan ni almacenan datos de pacientes.** La interfaz pide expresamente no introducir nombres, historias clínicas ni identificadores, y bloquea consultas con patrones de identificadores (DNI/NIE, NUHSA, números largos).
- Las preguntas se procesan **en el navegador**: no se envían a ningún servidor y no se guardan (sólo una caché en memoria que desaparece al cerrar la pestaña).
- Sin cookies, sin analítica, sin herramientas de seguimiento, sin claves API.
- **Voz:** el dictado usa la Web Speech API del navegador. En Chrome y Edge el audio puede enviarse a servidores de Google o Microsoft para transcribirlo; la interfaz lo advierte. La síntesis de voz («Escuchar») es local en la mayoría de sistemas. Si no se desea, puede usarse sólo texto.
- **IA local:** el modelo se descarga de Hugging Face (petición de archivos estáticos que revela la IP del visitante a ese proveedor, como cualquier descarga). Las preguntas nunca salen del dispositivo.

## Medidas técnicas

- Sitio estático sin backend ni base de datos: no hay datos de usuarios que proteger en el servidor.
- Cabeceras definidas en `vercel.json` (y aplicadas también en `npm run preview`):
  - `Content-Security-Policy` restrictiva: scripts sólo del propio dominio (más `wasm-unsafe-eval` para WebGPU), conexiones sólo al propio dominio y a los hosts del modelo (Hugging Face, GitHub raw), sin iframes (`frame-ancestors 'none'`).
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (micrófono sólo para el propio sitio; cámara y geolocalización desactivadas).
- Sin `dangerouslySetInnerHTML`: el texto del PDF y del modelo se renderiza como texto.
- Dependencias fijadas con `package-lock.json`.

## Comunicar un problema

Si detecta un fallo de seguridad o una cita incorrecta, abra una incidencia en el repositorio de GitHub indicando la pregunta, la respuesta obtenida y la página esperada (sin datos personales).
