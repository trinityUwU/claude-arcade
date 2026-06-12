import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AchievementResult, ScanResult } from "../src/types.ts";
import { ScoreHeader } from "./components/ScoreHeader.tsx";
import { BadgeCard } from "./components/BadgeCard.tsx";

const STATE_ORDER: Record<AchievementResult["state"], number> = { unlocked: 0, discovered: 1, secret: 2 };

function sortAchievements(list: AchievementResult[]): AchievementResult[] {
  return [...list].sort((a, b) => {
    if (a.state !== b.state) return STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (a.state === "unlocked") return b.tierIndex - a.tierIndex;
    return b.progress - a.progress;
  });
}

interface NavProps { cats: string[]; active: string; onPick: (c: string) => void }

function CategoryNav({ cats, active, onPick }: NavProps): React.JSX.Element {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {["Tous", ...cats].map((c) => (
        <button key={c} onClick={() => onPick(c)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            active === c ? "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100"
              : "border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80"}`}>
          {c}
        </button>
      ))}
    </nav>
  );
}

export function App(): React.JSX.Element {
  const [data, setData] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState("Tous");

  useEffect(() => {
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d: ScanResult) => setData(d))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const cats = useMemo(() => (data ? Object.keys(data.score.byCategory) : []), [data]);
  const shown = useMemo(() => {
    if (!data) return [];
    const filtered = cat === "Tous" ? data.achievements : data.achievements.filter((a) => a.category === cat);
    return sortAchievements(filtered);
  }, [data, cat]);

  if (error) return <Centered>Erreur de chargement : {error}</Centered>;
  if (!data) return <Centered>Scan en cours…</Centered>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ScoreHeader data={data} />
      <CategoryNav cats={cats} active={cat} onPick={setCat} />
      <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((a, i) => <BadgeCard key={a.id} a={a} index={i} />)}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex min-h-screen items-center justify-center text-white/50">{children}</div>;
}
