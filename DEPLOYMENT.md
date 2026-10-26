# Publicación

**URL pública:** <https://clinical-protocol-ai-kappa.vercel.app> (proyecto `clinical-protocol-ai` en Vercel Hobby, publicación automática desde la rama `main`). El dominio `clinical-protocol-ai.vercel.app` pertenece a otra cuenta.

La aplicación es un sitio estático: Vercel ejecuta `npm run build` y publica `dist/`. No hace falta Python en Vercel porque el índice (`public/data/index.json`) y el PDF (`data/protocols/`) están en el repositorio.

## 0. Comprobaciones previas (local)

```bash
npm ci
npm test                 # 38 pruebas superadas
npm run build
npm run preview          # http://localhost:4173, con las mismas cabeceras que Vercel
```

## 1. Repositorio en GitHub

```bash
git add .
git commit -m "Clinical Protocol AI: MVP"
gh repo create clinical-protocol-ai --public --source=. --remote=origin --push
```

Antes de subir, revise que no hay archivos inesperados con `git status` (`.venv/`, `node_modules/` y `dist/` están en `.gitignore`).

## 2. Vercel (plan Hobby, gratuito)

1. Entre en <https://vercel.com> con su cuenta de GitHub. **No añada método de pago ni acepte el periodo de prueba Pro.**
2. **Add New… → Project** → importe `clinical-protocol-ai`.
3. Vercel detecta Vite y lee `vercel.json`:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Variables de entorno: **ninguna**
4. Pulse **Deploy**. Cada `git push` a `main` vuelve a publicar automáticamente.

## 3. Verificación de la URL pública

En una **ventana de incógnito**:

- [ ] La página carga y muestra los avisos de demostración.
- [ ] Una pregunta de ejemplo devuelve fuentes con página; «Abrir PDF en la pág. N» abre el PDF en esa página.
- [ ] La pregunta sobre amoxicilina se rechaza con el mensaje exacto.
- [ ] Herramientas de desarrollo → Red: sólo peticiones al propio dominio.
- [ ] Cabeceras de la respuesta: `Content-Security-Policy` presente.
- [ ] Desde un móvil: panel «Documentos», micrófono (si el navegador lo admite) y lectura de respuestas.
- [ ] (Opcional, en un ordenador con Chrome/Edge) «Activar IA local» descarga el modelo y redacta con citas.

## 4. Portfolio (GitHub Pages)

Añadir una tarjeta que enlace a la URL de Vercel y al repositorio. Sólo se modificará el portfolio con autorización expresa.

## Actualizar los documentos

1. Editar `scripts/protocols.json` (URL, metadatos, `contentPages`, `glossaryPages`).
2. `python scripts/download_protocols.py --force` → `validate_protocols.py` → `build_index.py` → `verify_index.py`.
3. Actualizar las páginas esperadas de `tests/cases.ts`, ejecutar `npm test` y publicar.
