import { useCallback, useRef, useState } from "react";
import { ProtocolEngine } from "./engine";
import type { IndexData } from "./types";

export type EngineState = "idle" | "loading" | "ready" | "error";

/** Descarga el índice sólo cuando hace falta (primer foco o primera pregunta). */
export function useEngine() {
  const [state, setState] = useState<EngineState>("idle");
  const promise = useRef<Promise<ProtocolEngine> | null>(null);

  const load = useCallback(() => {
    if (!promise.current) {
      setState("loading");
      promise.current = fetch(`${import.meta.env.BASE_URL}data/index.json?v=${__INDEX_HASH__}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<IndexData>;
        })
        .then((data) => {
          const engine = new ProtocolEngine(data);
          setState("ready");
          return engine;
        })
        .catch((e) => {
          promise.current = null;
          setState("error");
          throw e;
        });
    }
    return promise.current;
  }, []);

  return { state, load };
}
