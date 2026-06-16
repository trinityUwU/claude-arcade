// Hook de streaming claude -p via SSE (EventSource) : texte live + temps écoulé, nettoyage
// au démontage, garde une-seule-exécution, fermeture sur done/error (zéro reconnexion auto).
// Mutualisé entre l'audit profond (sonnet) et la correction (opus).
import { useCallback, useEffect, useRef, useState } from "react";

interface StreamHandle<T> {
  text: string | null;   // null = inactif ; "" = démarrage ; sinon le flux accumulé
  elapsed: number;       // secondes depuis le start (feedback cold-start)
  running: boolean;
  start: () => void;
  reset: () => void;
}

export function useClaudeStream<T>(url: string, onDone: (r: T) => void): StreamHandle<T> {
  const [text, setText] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stop = useCallback(() => {
    esRef.current?.close(); esRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  useEffect(() => stop, [stop]);   // ferme tout si le composant se démonte

  const reset = useCallback(() => { stop(); setText(null); setElapsed(0); }, [stop]);

  const start = useCallback(() => {
    if (esRef.current) return;     // une seule exécution à la fois
    setText(""); setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    const es = new EventSource(url);
    esRef.current = es;
    es.addEventListener("delta", (ev) => {
      const { text: chunk } = JSON.parse((ev as MessageEvent).data) as { text: string };
      setText((prev) => (prev ?? "") + chunk);
    });
    es.addEventListener("done", (ev) => {
      onDoneRef.current(JSON.parse((ev as MessageEvent).data) as T);
      setText(null); stop();
    });
    es.addEventListener("error", () => { setText(null); stop(); });  // close → pas de reconnexion
  }, [url, stop]);

  return { text, elapsed, running: text !== null, start, reset };
}
