// Mise à jour temps réel SANS rejouer les animations (mode silencieux).
// Un « tick » global (poussé par le flux SSE) déclenche un refetch silencieux des panels :
// les données changent dynamiquement, mais l'entrée animée ne se rejoue pas tant qu'on reste
// sur la page. Naviguer vers un panel (remount) rejoue l'entrée — c'est voulu.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const TickContext = createContext(0);

export function LiveProvider({ tick, children }: { tick: number; children: React.ReactNode }): React.JSX.Element {
  return <TickContext.Provider value={tick}>{children}</TickContext.Provider>;
}

interface LiveResource<T> { data: T | null; silent: boolean; error: string | null; reload: () => void; }

/** Fetch un endpoint, refetch en silencieux à chaque tick. silent=false au 1ᵉʳ chargement. */
export function useLiveResource<T>(url: string): LiveResource<T> {
  const tick = useContext(TickContext);
  const [data, setData] = useState<T | null>(null);
  const [silent, setSilent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTick = useRef(tick);

  const fetchOnce = useCallback(async (asSilent: boolean) => {
    try {
      const r = await fetch(url);
      const j = (await r.json()) as T;
      setSilent(asSilent);
      setData(j);
    } catch (e: unknown) { setError(String(e)); }
  }, [url]);

  useEffect(() => { void fetchOnce(false); }, [fetchOnce]);  // chargement initial (animé)
  useEffect(() => {
    if (tick === lastTick.current) return;                   // pas un vrai update
    lastTick.current = tick;
    void fetchOnce(true);                                     // refresh de fond (silencieux)
  }, [tick, fetchOnce]);

  return { data, silent, error, reload: () => fetchOnce(false) };
}
