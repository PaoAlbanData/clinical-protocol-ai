/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// Huella del índice: cambia la URL de descarga en cada versión y evita que un
// navegador con caché combine la interfaz nueva con un índice antiguo.
const INDEX_HASH = createHash("sha256")
  .update(readFileSync(resolve(__dirname, "public/data/index.json")))
  .digest("hex")
  .slice(0, 12);

const PDF_DIR = resolve(__dirname, "data/protocols");

// Las cabeceras globales de vercel.json (CSP incluida) se aplican también en
// `vite preview`, para probar en local las mismas restricciones que en producción.
const vercelHeaders: Record<string, string> = Object.fromEntries(
  JSON.parse(readFileSync(resolve(__dirname, "vercel.json"), "utf-8"))
    .headers.find((h: { source: string }) => h.source === "/(.*)")
    .headers.map((h: { key: string; value: string }) => [h.key, h.value]),
);

/**
 * Sirve los PDF originales de data/protocols/ en /protocols/ (desarrollo) y los
 * copia sin modificar a dist/protocols/ (build), sin duplicarlos en el repo.
 */
function originalPdfs(): Plugin {
  const pdfs = () => (existsSync(PDF_DIR) ? readdirSync(PDF_DIR).filter((f) => f.endsWith(".pdf")) : []);
  return {
    name: "original-pdfs",
    configureServer(server) {
      server.middlewares.use("/protocols", (req, res, next) => {
        const name = decodeURIComponent((req.url ?? "").split(/[?#]/)[0].replace(/^\//, ""));
        if (!pdfs().includes(name)) return next();
        res.setHeader("Content-Type", "application/pdf");
        res.end(readFileSync(resolve(PDF_DIR, name)));
      });
    },
    generateBundle() {
      for (const f of pdfs()) {
        this.emitFile({ type: "asset", fileName: `protocols/${f}`, source: readFileSync(resolve(PDF_DIR, f)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), originalPdfs()],
  build: { chunkSizeWarningLimit: 7000 },
  preview: { headers: vercelHeaders },
  define: { __INDEX_HASH__: JSON.stringify(INDEX_HASH) },
  test: { environment: "node" },
});
