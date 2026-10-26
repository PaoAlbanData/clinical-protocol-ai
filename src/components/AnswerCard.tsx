import { useState } from "react";
import { citation } from "../lib/engine";
import { pdfLink } from "../lib/docs";
import { canSpeak, speak, stopSpeaking } from "../lib/speech";
import type { Answer, Source } from "../lib/types";
import { IconAlert, IconCheck, IconCopy, IconExternal, IconFile, IconSpeaker, IconStop } from "./Icons";

export interface AssistantMessage {
  answer: Answer;
  /** texto redactado por la IA local (si está activa) */
  generated?: string;
  generating?: boolean;
  /** aviso si la redacción se descartó por no superar la verificación */
  llmWarning?: string;
}

/** Sustituye [n] por enlaces a la fuente correspondiente. */
function withCitations(text: string, id: string) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    return (
      <a key={i} href={`#${id}-src-${m[1]}`} className="mx-0.5 rounded bg-brand-100 px-1 align-[1px] text-[11px] font-semibold text-brand-700 hover:bg-brand-200">
        {m[1]}
      </a>
    );
  });
}

/** Muestra «[Recomendación clase I, nivel de evidencia B]» como una etiqueta. */
function withRecommendations(text: string) {
  return text.split(/(\[Recomendación clase [^\]]+\])/g).map((part, i) =>
    part.startsWith("[Recomendación clase") ? (
      <span key={i} className="ml-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 align-[1px] text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function plainText(msg: AssistantMessage): string {
  const { answer } = msg;
  if (answer.kind !== "answer") return answer.text;
  const body = msg.generated ?? answer.sources.map((s) => `[${s.n}] ${s.excerpt.replace(/\n/g, " ")}`).join("\n\n");
  const refs = answer.sources.map((s) => `[${s.n}] ${citation(s)}. ${s.doc.url}`).join("\n");
  return `${body}\n\nFuentes:\n${refs}\n\nDemostración documental. No es un sistema de apoyo a decisiones clínicas.`;
}

function SourceItem({ s, id }: { s: Source; id: string }) {
  const printed = s.chunk.l && s.chunk.l !== s.chunk.p ? ` · impresa ${s.chunk.l}` : "";
  return (
    <li id={`${id}-src-${s.n}`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{s.n}</span>
        <div className="min-w-0 flex-1">
          <blockquote className="whitespace-pre-line border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-slate-800">
            {withRecommendations(s.excerpt)}
          </blockquote>
          {(s.chunk.s || s.chunk.c) && <p className="mt-2 text-xs text-slate-600">{s.chunk.s ?? s.chunk.c}</p>}
          <p className="mt-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{s.doc.shortTitle}</span> · {s.doc.institution} · {s.doc.year} ·{" "}
            <span className="font-medium text-slate-700">
              Pág. {s.chunk.p} del PDF{printed}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a className="btn-outline" href={pdfLink(s.doc.file, s.chunk.p)} target="_blank" rel="noopener">
              <IconFile className="h-3.5 w-3.5" /> Abrir PDF en la pág. {s.chunk.p}
            </a>
            <a className="btn-ghost" href={`${s.doc.url}#page=${s.chunk.p}`} target="_blank" rel="noopener noreferrer">
              <IconExternal className="h-3.5 w-3.5" /> Fuente oficial
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}

export function AnswerCard({ msg, id }: { msg: AssistantMessage; id: string }) {
  const { answer } = msg;
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(msg));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* portapapeles no disponible */
    }
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const spoken =
      answer.kind === "answer"
        ? (msg.generated ?? answer.sources.map((s) => `Según ${s.doc.shortTitle}, página ${s.chunk.p}: ${s.excerpt}`).join(". "))
        : answer.text;
    setSpeaking(true);
    speak(spoken, () => setSpeaking(false));
  };

  if (answer.kind !== "answer") {
    return (
      <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${answer.kind === "insufficient" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`}>
        {answer.kind === "insufficient" && <IconAlert className="mb-1 mr-1.5 inline h-4 w-4" />}
        {answer.text}
        {answer.kind === "insufficient" && (
          <p className="mt-2 text-xs text-amber-800">
            Pruebe a reformular con términos del consenso (p. ej. «TEP», «dímero-D», «anticoagulación», «filtro de vena cava», «embarazo»).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {msg.generated !== undefined ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">Redactado por IA local a partir de las fuentes · verifique</span>
        ) : (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-800">Respuesta documental · extractos literales</span>
        )}
        <span className="text-slate-400">{answer.sources.length} fuentes · {answer.ms} ms · sin servidores</span>
      </div>

      {msg.generating && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-violet-800 ring-1 ring-violet-100" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          Redactando con IA local… La redacción se mostrará sólo si todas sus frases citan las fuentes.
        </p>
      )}
      {msg.generated !== undefined && (
        <p className="mb-3 whitespace-pre-line rounded-xl bg-white p-3 text-sm leading-relaxed text-slate-800 ring-1 ring-violet-100" aria-live="polite">
          {withCitations(msg.generated, id)}        </p>
      )}
      {msg.llmWarning && (
        <p className="mb-3 flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          <IconAlert className="mt-0.5 h-3.5 w-3.5" />
          {msg.llmWarning}
        </p>
      )}
      {answer.multiDoc && (
        <p className="mb-3 flex gap-1.5 rounded-lg bg-sky-50 p-2 text-xs text-sky-900">
          <IconAlert className="mt-0.5 h-3.5 w-3.5" />
          Las fuentes proceden de varios protocolos de años distintos. Compárelas: pueden recoger criterios diferentes o desactualizados.
        </p>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {msg.generated !== undefined ? "Extractos de respaldo" : "Lo que dice el documento"}
      </p>
      <ol className="space-y-2">
        {answer.sources.map((s) => (
          <SourceItem key={s.n} s={s} id={id} />
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {canSpeak() && (
          <button className="btn-outline" onClick={toggleSpeak} aria-pressed={speaking}>
            {speaking ? <IconStop className="h-3.5 w-3.5" /> : <IconSpeaker className="h-3.5 w-3.5" />}
            {speaking ? "Detener" : "Escuchar"}
          </button>
        )}
        <button className="btn-outline" onClick={copy}>
          {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar respuesta"}
        </button>
      </div>
    </div>
  );
}
