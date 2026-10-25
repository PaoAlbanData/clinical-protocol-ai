/** Reconocimiento y síntesis de voz del navegador (Web Speech API). */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canRecognize = () => typeof window !== "undefined" && !!ctor();
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function startRecognition(handlers: {
  onText: (text: string, final: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): () => void {
  const Rec = ctor();
  if (!Rec) {
    handlers.onError("Este navegador no admite reconocimiento de voz. Escriba la pregunta.");
    return () => {};
  }
  const rec = new Rec();
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final ||= e.results[i].isFinal;
    }
    handlers.onText(text, final);
  };
  rec.onerror = (e) => {
    const msg: Record<string, string> = {
      "not-allowed": "Permiso de micrófono denegado.",
      "no-speech": "No se detectó voz. Inténtelo de nuevo.",
      network: "El reconocimiento de voz del navegador necesita conexión.",
    };
    handlers.onError(msg[e.error] ?? `Error de reconocimiento de voz (${e.error}).`);
  };
  rec.onend = handlers.onEnd;
  rec.start();
  return () => rec.stop();
}

export function speak(text: string, onEnd: () => void): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, "").replace(/[•\-–]\s/g, ""));
  u.lang = "es-ES";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
