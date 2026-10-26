import { useEffect, useRef, useState } from "react";
import { AnswerCard, type AssistantMessage } from "./components/AnswerCard";
import { IconAlert, IconBooks, IconMic, IconSend, IconShield, IconStop, IconX } from "./components/Icons";
import { Sidebar } from "./components/Sidebar";
import { generate, loadLlm, LLM_MODEL, verifyGenerated, webGpuAvailable, type LlmStatus } from "./lib/llm";
import { canRecognize, startRecognition } from "./lib/speech";
import { useEngine } from "./lib/useEngine";
import { INSUFFICIENT } from "./lib/engine";

type Message = { id: string; role: "user"; text: string } | { id: string; role: "assistant"; data: AssistantMessage };

const EXAMPLES = [
  "¿Qué pacientes con TEP pueden tratarse de forma ambulatoria?",
  "¿Cuándo se puede usar el dímero-D ajustado por edad?",
  "¿Cuándo está indicado un filtro de vena cava inferior?",
  "¿Cómo se revierte el dabigatrán en un sangrado crítico?",
  "¿Cuál es la dosis de amoxicilina en la otitis media?",
];

// Patrones de datos identificativos que no deben escribirse en la consulta.
const PERSONAL_DATA = /\b(\d{8}[A-Za-z]|[XYZ]\d{7}[A-Za-z]|AN\d{10}|NUHSA|\d{9,})\b|historia cl[ií]nica (n[ºo°]|número)/i;

export default function App() {
  const { state: engineState, load } = useEngine();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>("off");
  const [llmProgress, setLlmProgress] = useState({ pct: 0, text: "" });
  const [llmEnabled, setLlmEnabled] = useState(false);
  const stopRec = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Desplazar a la última pregunta para leer pregunta y respuesta desde el principio.
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    if (lastQuestion) document.getElementById(`msg-${lastQuestion}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [lastQuestion, messages.length]);

  const update = (id: string, patch: Partial<AssistantMessage>) =>
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === "assistant" ? { ...m, data: { ...m.data, ...patch } } : m)));

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q || busy) return;
    if (PERSONAL_DATA.test(q)) {
      setVoiceNote("La pregunta parece contener un identificador personal. Elimínelo y formule una pregunta general.");
      return;
    }
    setInput("");
    setVoiceNote(null);
    setBusy(true);
    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();
    setMessages((ms) => [...ms, { id: uid, role: "user", text: q }]);
    try {
      const engine = await load();
      const answer = engine.ask(q);
      const useLlm = llmEnabled && llmStatus === "ready" && answer.kind === "answer";
      setMessages((ms) => [...ms, { id: aid, role: "assistant", data: { answer, generating: useLlm } }]);
      if (useLlm) {
        try {
          // La redacción no se muestra mientras se genera: sólo tras superar la verificación.
          const text = await generate(q, answer.sources, () => {});
          const problem = verifyGenerated(text, answer.sources);
          if (problem) {
            update(aid, { generating: false, llmWarning: `${problem} Se ha descartado la redacción de la IA local; se muestran los extractos literales.` });
          } else if (text.includes(INSUFFICIENT.slice(0, 40))) {
            update(aid, { generated: text, generating: false, llmWarning: "La IA local considera que los extractos no responden a la pregunta. Revíselos con cautela." });
          } else {
            update(aid, { generated: text, generating: false });
          }
        } catch {
          update(aid, { generated: undefined, generating: false, llmWarning: "La IA local falló; se muestran los extractos literales." });
        }
      }
    } catch {
      setMessages((ms) => [
        ...ms,
        {
          id: aid,
          role: "assistant",
          data: { answer: { kind: "help", text: "No se pudo cargar el índice documental. Compruebe la conexión y vuelva a intentarlo.", sources: [], multiDoc: false, mode: "extractive", ms: 0 } },
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      stopRec.current();
      return;
    }
    setVoiceNote(null);
    load().catch(() => {});
    setListening(true);
    stopRec.current = startRecognition({
      onText: (text, final) => {
        setInput(text);
        if (final) ask(text);
      },
      onError: (m) => setVoiceNote(m),
      onEnd: () => setListening(false),
    });
  }

  async function activateLlm() {
    const ok = window.confirm(
      `Se descargarán ≈${(LLM_MODEL.downloadMB / 1000).toFixed(1)} GB (modelo ${LLM_MODEL.label}) desde Hugging Face a la caché de su navegador. ` +
        "Requiere WebGPU y ≈1,6 GB de memoria gráfica. Las preguntas no salen de su dispositivo. ¿Continuar?",
    );
    if (!ok) return;
    if (!(await webGpuAvailable())) {
      setLlmStatus("unsupported");
      return;
    }
    setLlmStatus("loading");
    try {
      await loadLlm((pct, text) => setLlmProgress({ pct, text }));
      setLlmStatus("ready");
      setLlmEnabled(true);
    } catch {
      setLlmStatus("error");
    }
  }

  const sidebar = (
    <Sidebar llmStatus={llmStatus} llmProgress={llmProgress} llmEnabled={llmEnabled} onActivateLlm={activateLlm} onToggleLlm={setLlmEnabled} />
  );

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">Clinical Protocol AI</h1>
              <p className="text-xs text-slate-500">Consulta documental de protocolos clínicos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:inline">Demo · sin uso clínico</span>
            <button className="btn-outline lg:hidden" onClick={() => setShowDocs(true)} aria-label="Ver documentos y opciones">
              <IconBooks /> Documentos
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <p className="mx-auto flex max-w-7xl gap-2 px-4 py-2 text-xs leading-relaxed text-amber-900">
          <IconAlert className="mt-0.5 h-3.5 w-3.5 text-amber-700" />
          <span>
            <strong>Herramienta de demostración.</strong> No es un sistema autorizado de diagnóstico, prescripción ni apoyo a decisiones clínicas.
            Consulta el Consenso de Enfermedad Tromboembólica Venosa de la Sociedad Argentina de Cardiología (2025); verifique siempre en el documento original.
          </span>
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-5">
        <aside className="hidden w-80 shrink-0 lg:block">{sidebar}</aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 pb-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">¿Qué quiere consultar sobre la enfermedad tromboembólica venosa?</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Escriba o dicte una pregunta general sobre tromboembolia de pulmón (TEP) o trombosis venosa profunda (TVP): diagnóstico,
                  estratificación del riesgo, anticoagulación, fibrinólisis, filtros, embarazo, cáncer… El buscador localiza los fragmentos del
                  consenso <strong>directamente en su navegador</strong> y responde con extractos literales, la página del PDF y, cuando la hay,
                  la clase de recomendación y el nivel de evidencia. Si no hay evidencia suficiente, lo indica.
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Ejemplos</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => ask(e)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-sm text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} id={`msg-${m.id}`} className="flex scroll-mt-24 justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm text-white shadow-sm">{m.text}</p>
                </div>
              ) : (
                <AnswerCard key={m.id} msg={m.data} id={m.id} />
              ),
            )}
            {busy && engineState === "loading" && (
              <p className="text-sm text-slate-500" role="status">
                Cargando índice documental (una sola vez)…
              </p>
            )}
          </div>

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 pb-4 pt-3 backdrop-blur">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"
            >
              <label htmlFor="q" className="sr-only">
                Pregunta
              </label>
              <textarea
                id="q"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={400}
                onFocus={() => load().catch(() => {})}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                placeholder={listening ? "Escuchando…" : "Escriba su pregunta…"}
                className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[15px] focus:outline-none focus:ring-0"
              />
              {canRecognize() && (
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${listening ? "animate-pulse bg-red-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  aria-label={listening ? "Detener dictado" : "Preguntar por voz"}
                  title={listening ? "Detener dictado" : "Preguntar por voz"}
                >
                  {listening ? <IconStop className="h-5 w-5" /> : <IconMic className="h-5 w-5" />}
                </button>
              )}
              <button type="submit" disabled={!input.trim() || busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40" aria-label="Enviar pregunta">
                <IconSend className="h-5 w-5" />
              </button>
            </form>
            {voiceNote && <p className="mt-2 text-xs text-red-700">{voiceNote}</p>}
            <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-slate-500">
              <IconShield className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                No introduzca nombres ni datos de pacientes. La búsqueda se ejecuta en su navegador y no se guarda nada.
                {canRecognize() && (
                  <span title="En Chrome o Edge, el reconocimiento de voz puede enviar el audio a servidores de Google o Microsoft.">
                    {" "}El dictado por voz puede usar servidores del proveedor del navegador (Google o Microsoft).
                  </span>
                )}
              </span>
            </p>
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-7xl px-4 py-3 text-[11px] leading-relaxed text-slate-500">
          Fuente: «Consenso para el Diagnóstico y Tratamiento de la Enfermedad Tromboembólica Venosa», Sociedad Argentina de Cardiología
          en colaboración con la Sociedad Argentina de Hematología. Rev Argent Cardiol 2025;93(Supl 6). Licencia{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by-nc-sa/2.5/ar/" target="_blank" rel="noopener noreferrer">
            CC BY-NC-SA 2.5 AR
          </a>
          ; el PDF se reproduce sin modificaciones. Proyecto de portfolio sin ánimo de lucro, sin analítica ni cookies.
        </p>
      </footer>

      {showDocs && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Documentos y opciones">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowDocs(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-slate-50 p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Documentos y opciones</p>
              <button className="btn-ghost" onClick={() => setShowDocs(false)} aria-label="Cerrar">
                <IconX />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
