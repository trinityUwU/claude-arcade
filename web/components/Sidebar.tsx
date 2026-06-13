import {
  LayoutGrid, Gamepad2, Brain, Layers, ScrollText, TriangleAlert, Trophy, TrendingUp, Zap, Activity, Compass, Sparkles, GitBranch, LineChart, SlidersHorizontal,
} from "lucide-react";
import type { ScanResult } from "../../src/types.ts";
import { TIER_COLOR } from "../lib/tiers.ts";
import { categoryIcon } from "../lib/icons.tsx";

export type View =
  | "arcade" | "brain" | "consolidate" | "skills" | "config"
  | "learning" | "sessions" | "problems" | "schemas" | "resolutions" | "principles" | "evolution" | "injections" | "realtime";

interface SidebarProps {
  data: ScanResult; active: string; onPick: (c: string) => void;
  view: View; onView: (v: View) => void;
}

interface NavEntry { view: View; label: string; Icon: typeof LayoutGrid; }

const ARCADE_NAV: NavEntry[] = [
  { view: "arcade", label: "Arcade", Icon: Gamepad2 },
  { view: "brain", label: "Cerveau", Icon: Brain },
  { view: "consolidate", label: "Conso", Icon: Layers },
  { view: "skills", label: "Skills", Icon: Sparkles },
  { view: "config", label: "Config", Icon: SlidersHorizontal },
];

const LEARN_NAV: NavEntry[] = [
  { view: "learning", label: "Apprentissage", Icon: LineChart },
  { view: "sessions", label: "Sessions", Icon: ScrollText },
  { view: "problems", label: "Problèmes", Icon: TriangleAlert },
  { view: "schemas", label: "Schémas", Icon: Trophy },
  { view: "resolutions", label: "Résolutions", Icon: GitBranch },
  { view: "principles", label: "Principes", Icon: Compass },
  { view: "evolution", label: "Évolution", Icon: TrendingUp },
  { view: "injections", label: "Injection", Icon: Zap },
  { view: "realtime", label: "Temps réel", Icon: Activity },
];

function NavItem(
  { label, count, total, active, onClick, Icon }:
  { label: string; count?: number; total?: number; active: boolean; onClick: () => void; Icon: typeof LayoutGrid },
): React.JSX.Element {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]
        transition-colors ${active ? "nav-active" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"}`}>
      <Icon size={16} strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] tabular-nums text-white/35">{count}/{total}</span>
      )}
    </button>
  );
}

function GroupHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="mb-1 mt-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
      {label}
    </div>
  );
}

function CategoryBlock({ data, active, onPick }: Pick<SidebarProps, "data" | "active" | "onPick">): React.JSX.Element {
  const s = data.score;
  return (
    <div className="mt-1">
      <NavItem label="Vue d'ensemble" active={active === "Tous"}
        onClick={() => onPick("Tous")} Icon={LayoutGrid} />
      <div className="my-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Catégories</div>
      {Object.entries(s.byCategory).map(([cat, v]) => (
        <NavItem key={cat} label={cat} count={v.unlocked} total={v.total}
          active={active === cat} onClick={() => onPick(cat)} Icon={categoryIcon(cat)} />
      ))}
    </div>
  );
}

export function Sidebar({ data, active, onPick, view, onView }: SidebarProps): React.JSX.Element {
  const s = data.score;
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.07] bg-black/20 px-3 py-5">
      <div className="mb-4 flex items-center gap-2 px-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-fuchsia-400/12 text-fuchsia-200">
          <Gamepad2 size={18} strokeWidth={2} />
        </div>
        <span className="text-sm font-bold tracking-tight text-white/85">Claude Arcade</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <GroupHeader label="Arcade" />
        {ARCADE_NAV.map((e) => (
          <NavItem key={e.view} label={e.label} active={view === e.view}
            onClick={() => onView(e.view)} Icon={e.Icon} />
        ))}
        {view === "arcade" && <CategoryBlock data={data} active={active} onPick={onPick} />}
        <GroupHeader label="Apprentissage" />
        {LEARN_NAV.map((e) => (
          <NavItem key={e.view} label={e.label} active={view === e.view}
            onClick={() => onView(e.view)} Icon={e.Icon} />
        ))}
      </nav>
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-white/35">Rang</span>
          <span className={`text-sm font-bold ${TIER_COLOR[s.rank]}`}>{s.rank}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-black tabular-nums text-white/90">{s.totalPoints.toLocaleString("fr")}</span>
          <span className="text-[11px] text-white/40">pts</span>
        </div>
        <div className="mt-1 text-[11px] text-white/35">{s.unlockedCount}/{s.totalCount} débloqués</div>
      </div>
    </aside>
  );
}
