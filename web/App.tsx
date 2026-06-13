import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AchievementResult, ScanResult } from "../src/types.ts";
import { Sidebar, type View } from "./components/Sidebar.tsx";
import { Topbar } from "./components/Topbar.tsx";
import { BadgeCard } from "./components/BadgeCard.tsx";
import { BrainGraph } from "./components/BrainGraph.tsx";
import { ConsolidatePanel } from "./components/ConsolidatePanel.tsx";
import { SkillsPanel } from "./components/SkillsPanel.tsx";
import { SessionsPanel } from "./components/SessionsPanel.tsx";
import { ProblemsPanel } from "./components/ProblemsPanel.tsx";
import { SchemasPanel } from "./components/SchemasPanel.tsx";
import { PrinciplesPanel } from "./components/PrinciplesPanel.tsx";
import { EvolutionPanel } from "./components/EvolutionPanel.tsx";
import { InjectionsPanel } from "./components/InjectionsPanel.tsx";
import { SessionEndPanel } from "./components/SessionEndPanel.tsx";

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
  const [view, setView] = useState<View>("arcade");
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
  // Tolérant aux coupures : EventSource se reconnecte seul → on ne passe « Hors ligne »
  // que si la coupure dure (>5s), pour éviter le clignotement du badge Live.
  useEffect(() => {
    const es = new EventSource("/api/stream");
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = (): void => { if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; } };
    es.onopen = () => { clearTimer(); setLive(true); };
    es.onerror = () => {
      if (offlineTimer) return;
      offlineTimer = setTimeout(() => setLive(false), 5000);
    };
    es.addEventListener("update", (e) => setData(JSON.parse((e as MessageEvent).data) as ScanResult));
    return () => { clearTimer(); es.close(); };
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
      <Sidebar data={data} active={cat} onPick={setCat} view={view} onView={setView} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Topbar data={data} onRescan={rescan} scanning={scanning} live={live} />
        <ViewRouter view={view} shown={shown} />
      </main>
    </div>
  );
}

function ArcadeGrid({ shown }: { shown: AchievementResult[] }): React.JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {shown.map((a, i) => <BadgeCard key={a.id} a={a} index={i} />)}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ViewRouter({ view, shown }: { view: View; shown: AchievementResult[] }): React.JSX.Element {
  switch (view) {
    case "brain": return <div className="flex flex-1 overflow-hidden"><BrainGraph /></div>;
    case "consolidate": return <div className="flex flex-1 overflow-y-auto"><ConsolidatePanel /></div>;
    case "skills": return <SkillsPanel />;
    case "sessions": return <SessionsPanel />;
    case "problems": return <ProblemsPanel />;
    case "schemas": return <SchemasPanel />;
    case "principles": return <PrinciplesPanel />;
    case "evolution": return <EvolutionPanel />;
    case "injections": return <InjectionsPanel />;
    case "realtime": return <SessionEndPanel />;
    default: return <ArcadeGrid shown={shown} />;
  }
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex min-h-screen items-center justify-center text-white/50">{children}</div>;
}
