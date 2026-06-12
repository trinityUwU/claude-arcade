import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AchievementResult, ScanResult } from "../src/types.ts";
import { Sidebar } from "./components/Sidebar.tsx";
import { Topbar } from "./components/Topbar.tsx";
import { BadgeCard } from "./components/BadgeCard.tsx";

const STATE_ORDER: Record<AchievementResult["state"], number> = { unlocked: 0, discovered: 1, secret: 2 };

function sortAchievements(list: AchievementResult[]): AchievementResult[] {
  return [...list].sort((a, b) => {
    if (a.state !== b.state) return STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (a.state === "unlocked") return b.tierIndex - a.tierIndex;
    return b.progress - a.progress;
  });
}

export function App(): React.JSX.Element {
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState("Tous");
  const [scanning, setScanning] = useState(false);
  const [live, setLive] = useState(false);

  const load = useCallback(async (url: string, method = "GET") => {
    try {
      const r = await fetch(url, { method });
      setData((await r.json()) as ScanResult);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, []);

  useEffect(() => { void load("/api/achievements"); }, [load]);

  // Flux temps réel : le serveur pousse un scan frais à chaque activité de session.
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("update", (e) => setData(JSON.parse((e as MessageEvent).data) as ScanResult));
    return () => es.close();
  }, []);

  const rescan = useCallback(async () => {
    setScanning(true);
    await load("/api/rescan", "POST");
    setScanning(false);
  }, [load]);

  const shown = useMemo(() => {
    if (!data) return [];
    const f = cat === "Tous" ? data.achievements : data.achievements.filter((a) => a.category === cat);
    return sortAchievements(f);
  }, [data, cat]);

  if (error) return <Centered>Erreur de chargement : {error}</Centered>;
  if (!data) return <Centered>Scan en cours…</Centered>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar data={data} active={cat} onPick={setCat} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Topbar data={data} onRescan={rescan} scanning={scanning} live={live} />
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {shown.map((a, i) => <BadgeCard key={a.id} a={a} index={i} />)}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex min-h-screen items-center justify-center text-white/50">{children}</div>;
}
