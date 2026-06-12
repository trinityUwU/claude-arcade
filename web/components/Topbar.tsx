import { RefreshCw, Trophy } from "lucide-react";
import type { ScanResult } from "../../src/types.ts";

interface TopbarProps { data: ScanResult; onRescan: () => void; scanning: boolean; live: boolean }

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

export function Topbar({ data, onRescan, scanning, live }: TopbarProps): React.JSX.Element {
  return (
    <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#0b0b12]/80 px-8 py-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy size={26} strokeWidth={1.75} className="text-amber-200/80" />
          <h1 className="arcade-title text-3xl font-black tracking-tight">CLAUDE ARCADE</h1>
        </div>
        <div className="flex items-center gap-3">
        <LiveBadge live={live} />
        <button onClick={onRescan} disabled={scanning}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5
            text-[13px] text-white/70 transition hover:border-white/20 hover:text-white/90 disabled:opacity-50">
          <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scan…" : "Rescan"}
        </button>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] text-white/35">
        {data.sessionCount.toLocaleString("fr")} sessions · scan {lastScan(data.generatedAt)} · 100% local, zéro API externe
      </p>
    </div>
  );
}
