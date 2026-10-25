import { DOCUMENTS } from "../lib/docs";
import { LLM_MODEL, type LlmStatus } from "../lib/llm";
import { IconAlert, IconChip, IconExternal, IconFile } from "./Icons";

interface Props {
  llmStatus: LlmStatus;
  llmProgress: { pct: number; text: string };
  llmEnabled: boolean;
  onActivateLlm: () => void;
  onToggleLlm: (on: boolean) => void;
}

export function Sidebar({ llmStatus, llmProgress, llmEnabled, onActivateLlm, onToggleLlm }: Props) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="docs-title">
        <h2 id="docs-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Documentos incluidos ({DOCUMENTS.length})
        </h2>
        <ul className="space-y-2.5">
          {DOCUMENTS.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{d.shortTitle}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{d.institution}</p>
                </div>
                <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200" title="Documento antiguo: puede no reflejar la evidencia actual">
                  {d.year}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a className="btn-outline" href={d.localUrl} target="_blank" rel="noopener">
                  <IconFile className="h-3.5 w-3.5" /> Abrir PDF
                </a>
                <a className="btn-ghost" href={d.url} target="_blank" rel="noopener noreferrer" title="Documento en GuíaSalud">
                  <IconExternal className="h-3.5 w-3.5" /> GuíaSalud
                </a>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-1.5 text-xs leading-relaxed text-slate-500">
          <IconAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
          Documentos de 2015–2020 usados sólo como material de simulación. No representan protocolos hospitalarios vigentes.
        </p>
      </section>

      <section aria-labelledby="llm-title" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <h2 id="llm-title" className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <IconChip /> IA local (opcional)
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Por defecto las respuestas son <strong>extractivas</strong>: frases literales de los PDF con su página. Opcionalmente,
          un modelo de lenguaje puede redactarlas <strong>en su dispositivo</strong>, sin enviar datos a ningún servidor.
        </p>

        {llmStatus === "off" && (
          <>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
              <li>Descarga única de ≈{(LLM_MODEL.downloadMB / 1000).toFixed(1)} GB (queda en caché del navegador).</li>
              <li>Navegador con WebGPU: Chrome o Edge recientes en ordenador.</li>
              <li>≈{(LLM_MODEL.vramMB / 1000).toFixed(1)} GB de memoria gráfica libre. No recomendado en móviles ni con datos móviles.</li>
            </ul>
            <button className="btn-primary mt-3 w-full justify-center" onClick={onActivateLlm}>
              Activar IA local
            </button>
          </>
        )}
        {llmStatus === "loading" && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${llmProgress.pct}%` }} />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
              {llmProgress.pct}% · {llmProgress.text || "Preparando…"}
            </p>
          </div>
        )}
        {llmStatus === "ready" && (
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 text-sm">
            <span className="text-slate-700">Redactar con IA local</span>
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={llmEnabled} onChange={(e) => onToggleLlm(e.target.checked)} />
          </label>
        )}
        {llmStatus === "unsupported" && (
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            Este dispositivo o navegador no admite WebGPU. La búsqueda documental sigue funcionando con normalidad.
          </p>
        )}
        {llmStatus === "error" && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            No se pudo cargar el modelo (memoria o conexión insuficiente). La búsqueda documental sigue funcionando.
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-400">{LLM_MODEL.label} · WebLLM</p>
      </section>
    </div>
  );
}
