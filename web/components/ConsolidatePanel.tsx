import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Play, Square, Check, SkipForward, AlertTriangle } from "lucide-react";
import type { ConsolidateStatus } from "../../src/consolidate/types.ts";

const PRESETS = [25, 50, 100] as const;

export function ConsolidatePanel(): React.JSX.Element {
  const [status, setStatus] = useState<ConsolidateStatus | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/consolidate/status");
      setStatus((await r.json()) as ConsolidateStatus);
    } catch { /* transient — le prochain tick réessaie */ }
  }, []);

  // Poll rapide tant qu'un run tourne, lent sinon (juste pour le compteur en attente).
  useEffect(() => {
    void refresh();
    const tick = (): void => { void refresh(); };
    timer.current = setInterval(tick, status?.running ? 1500 : 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [refresh, status?.running]);

  const launch = useCallback(async (quota?: number) => {
    setBusy(true);
    try {
      await fetch("/api/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quota ? { quota } : {}),
      });
      await refresh();
    } finally { setBusy(false); }
  }, [refresh]);

  const stop = useCallback(async () => {
    setBusy(true);
    try { await fetch("/api/consolidate/stop", { method: "POST" }); await refresh(); }
    finally { setBusy(false); }
  }, [refresh]);

  const running = status?.running ?? false;
  const pending = status?.pending ?? 0;
  const p = status?.progress;
  const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
  const customN = Number(custom);
  const customValid = Number.isFinite(customN) && customN > 0;

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-400/12 text-fuchsia-200">
          <Layers size={20} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white/90">Consolidation</h1>
          <p className="text-[13px] text-white/45">
            Résume tes sessions passées via Claude Code (sonnet, ton abonnement).
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-widest text-white/35">En attente</span>
          <span className="text-3xl font-black tabular-nums text-white/90">{pending.toLocaleString("fr")}</span>
        </div>

        {running && p ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="text-white/70">
                {p.done}/{p.total}{p.current ? <span className="text-white/40"> · {p.current}</span> : null}
              </span>
              <span className="tabular-nums text-white/50">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div className="h-full rounded-full bg-fuchsia-400/80"
                animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
            </div>
            <div className="mt-3 flex gap-4 text-[12px] text-white/55">
              <Stat Icon={Check} v={p.summarized} label="résumées" tone="text-emerald-300/80" />
              <Stat Icon={SkipForward} v={p.skipped} label="sautées" tone="text-white/45" />
              <Stat Icon={AlertTriangle} v={p.failed} label="échecs" tone="text-amber-300/80" />
            </div>
            <button onClick={() => void stop()} disabled={busy}
              className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2
                text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.05] disabled:opacity-40">
              <Square size={14} strokeWidth={2} /> Arrêter
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-white/30">
              Lancer
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((n) => (
                <button key={n} onClick={() => void launch(n)} disabled={busy || pending === 0}
                  className="rounded-lg border border-white/10 px-3.5 py-2 text-[13px] font-semibold
                    text-white/80 transition-colors hover:bg-white/[0.05] disabled:opacity-40">
                  {n}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric" placeholder="autre" disabled={busy || pending === 0}
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px]
                    text-white/85 outline-none placeholder:text-white/30 focus:border-fuchsia-400/40 disabled:opacity-40" />
                <button onClick={() => void launch(customN)} disabled={busy || !customValid || pending === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-fuchsia-400/15 px-3 py-2 text-[13px]
                    font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-400/25 disabled:opacity-40">
                  <Play size={13} strokeWidth={2.5} /> Go
                </button>
              </div>
              <button onClick={() => void launch(pending)} disabled={busy || pending === 0}
                className="rounded-lg bg-fuchsia-400/15 px-3.5 py-2 text-[13px] font-semibold
                  text-fuchsia-100 transition-colors hover:bg-fuchsia-400/25 disabled:opacity-40">
                Tout ({pending})
              </button>
            </div>
          </div>
        )}

        {!running && status?.lastRun ? (
          <p className="mt-5 border-t border-white/[0.06] pt-4 text-[12px] text-white/40">
            Dernier run : {status.lastRun.summarized} résumées · {status.lastRun.skipped} sautées
            {status.lastRun.failed ? ` · ${status.lastRun.failed} échecs` : ""}
            {" "}en {(status.lastRun.ms / 1000).toFixed(0)}s
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Stat(
  { Icon, v, label, tone }:
  { Icon: typeof Check; v: number; label: string; tone: string },
): React.JSX.Element {
  return (
    <span className={`flex items-center gap-1.5 ${tone}`}>
      <Icon size={13} strokeWidth={2} /> <span className="tabular-nums">{v}</span> {label}
    </span>
  );
}
