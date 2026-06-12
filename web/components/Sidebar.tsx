import { LayoutGrid, Gamepad2, Brain } from "lucide-react";
import type { ScanResult } from "../../src/types.ts";
import { TIER_COLOR } from "../lib/tiers.ts";
import { categoryIcon } from "../lib/icons.tsx";

export type View = "arcade" | "brain";

interface SidebarProps {
  data: ScanResult; active: string; onPick: (c: string) => void;
  view: View; onView: (v: View) => void;
}

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

function ViewTab(
  { label, Icon, active, onClick }:
  { label: string; Icon: typeof LayoutGrid; active: boolean; onClick: () => void },
): React.JSX.Element {
  return (
    <button onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px]
        font-semibold transition-colors ${active ? "nav-active" : "text-white/45 hover:text-white/75"}`}>
      <Icon size={14} strokeWidth={2} />
      {label}
    </button>
  );
}

export function Sidebar({ data, active, onPick, view, onView }: SidebarProps): React.JSX.Element {
  const s = data.score;
  const arcade = view === "arcade";
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/[0.07] bg-black/20 px-3 py-5">
      <div className="mb-5 flex items-center gap-2 px-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-fuchsia-400/12 text-fuchsia-200">
          <Gamepad2 size={18} strokeWidth={2} />
        </div>
        <span className="text-sm font-bold tracking-tight text-white/85">Claude Arcade</span>
      </div>
      <div className="mb-3 flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        <ViewTab label="Arcade" Icon={Gamepad2} active={arcade} onClick={() => onView("arcade")} />
        <ViewTab label="Cerveau" Icon={Brain} active={!arcade} onClick={() => onView("brain")} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {arcade ? (
          <>
            <NavItem label="Vue d'ensemble" active={active === "Tous"}
              onClick={() => onPick("Tous")} Icon={LayoutGrid} />
            <div className="my-2 px-2.5 text-[10px] font-semibold uppercase
              tracking-widest text-white/25">Catégories</div>
            {Object.entries(s.byCategory).map(([cat, v]) => (
              <NavItem key={cat} label={cat} count={v.unlocked} total={v.total}
                active={active === cat} onClick={() => onPick(cat)} Icon={categoryIcon(cat)} />
            ))}
          </>
        ) : (
          <p className="px-2.5 text-[12px] leading-relaxed text-white/40">
            Le réseau de ta pratique : sessions, projets, notions, erreurs récurrentes et process gagnants,
            reliés. Survole un nœud pour le détail, zoome pour explorer.
          </p>
        )}
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
