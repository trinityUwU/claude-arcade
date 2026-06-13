import { RefreshCw, Trophy, Menu } from "lucide-react";
import type { ScanResult } from "../../src/types.ts";

interface TopbarProps { data: ScanResult; onRescan: () => void; scanning: boolean; live: boolean; onMenu: () => void }

function lastScan(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
}

function LiveBadge({ live }: { live: boolean }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10
      bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55">
      <span className={`size-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
      {live ? "Live" : "Hors ligne"}
    </span>
  );
}

export function Topbar({ data, onRescan, scanning, live, onMenu }: TopbarProps): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#0b0b12]/80 px-4 py-4 backdrop-blur-md md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <button onClick={onMenu} aria-label="Menu"
            className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/70 md:hidden">
            <Menu size={18} />
          </button>
          <Trophy size={22} strokeWidth={1.75} className="shrink-0 text-amber-200/80 md:size-[26px]" />
          <h1 className="arcade-title truncate text-xl font-black tracking-tight md:text-3xl">CLAUDE ARCADE</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <LiveBadge live={live} />
          <button onClick={onRescan} disabled={scanning}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5
              text-[13px] text-white/70 transition hover:border-white/20 hover:text-white/90 disabled:opacity-50 md:px-3">
            <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{scanning ? "Scan…" : "Rescan"}</span>
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[12px] text-white/35 md:text-[13px]">
        {data.sessionCount.toLocaleString("fr")} sessions · scan {lastScan(data.generatedAt)} · 100% local
      </p>
    </div>
  );
}
