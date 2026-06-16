import { useCallback, useEffect, useState } from "react";
import { Code2, FileText, Sparkles, History, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import type { Upgrade } from "../../src/audit/types.ts";
import { Overlay } from "../lib/Overlay.tsx";
import { Markdown } from "../lib/Markdown.tsx";

type Tab = "before" | "analysis" | "after";
const TABS: Array<{ key: Tab; label: string; Icon: typeof Code2 }> = [
  { key: "before", label: "Avant", Icon: Code2 },
  { key: "analysis", label: "Analyse", Icon: FileText },
  { key: "after", label: "Après (opus)", Icon: Sparkles },
];

function fmtDate(at: number): string {
  return new Date(at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function UpgradeView(
  { u, isMd, onRestore, restoring }:
  { u: Upgrade; isMd: boolean; onRestore: (content: string) => void; restoring: boolean },
): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("after");
  const raw = tab === "before" ? u.before : tab === "after" ? u.after : u.analysis;
  const render = tab === "analysis" || isMd;
  const restorable = tab !== "analysis";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition ${
              tab === key ? "border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200" : "border-white/10 text-white/45 hover:text-white/75"}`}>
            <Icon size={11} />{label}
          </button>
        ))}
        {restorable && (
          <button onClick={() => onRestore(raw)} disabled={restoring}
            title={`Restaurer cet état (${tab === "before" ? "avant" : "après"}) comme version courante`}
            className="ml-auto flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-400/[0.08] px-2 py-0.5 text-[11px] text-sky-200 transition hover:bg-sky-400/[0.14] disabled:opacity-50">
            {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Restaurer cet état
          </button>
        )}
      </div>
      <div className="max-h-[42vh] overflow-y-auto rounded-lg bg-black/20 p-3">
        {render
          ? <Markdown content={raw} />
          : <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-white/75">{raw}</pre>}
      </div>
    </div>
  );
}

export function UpgradeHistory(
  { relPath, onClose, onRestored }: { relPath: string; onClose: () => void; onRestored?: () => void },
): React.JSX.Element {
  const [list, setList] = useState<Upgrade[] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const isMd = relPath.endsWith(".md");
  const load = useCallback(async () => {
    try { setList((await (await fetch(`/api/audit/upgrades?path=${encodeURIComponent(relPath)}`)).json()) as Upgrade[]); }
    catch { setList([]); }
  }, [relPath]);
  useEffect(() => { void load(); }, [load]);

  const restore = useCallback(async (content: string) => {
    setRestoring(true);
    try {
      const r = await fetch("/api/audit/restore", { method: "POST", body: JSON.stringify({ path: relPath, content }) });
      if (r.ok) { await load(); onRestored?.(); }
    } finally { setRestoring(false); }
  }, [relPath, load, onRestored]);

  return (
    <Overlay title={`Historique — ${relPath}`} onClose={onClose}>
      {list === null ? <span className="text-white/40">Chargement…</span>
        : !list.length ? <span className="text-white/40">Aucun upgrade.</span>
        : (
          <div className="flex flex-col gap-4">
            {(() => {
              const upgradeCount = list.filter((u) => !u.external).length;
              let n = upgradeCount;
              return list.map((u) => {
                const num = u.external ? null : n--;
                return (
                  <div key={u.at}>
                    {u.external ? (
                      <div className="mb-1.5 flex items-center gap-2 text-[12px] text-amber-200/85">
                        <AlertTriangle size={13} className="text-amber-300/80" />
                        <span className="font-semibold">Modification externe (hors Arcade)</span>
                        <span className="text-amber-200/40">{fmtDate(u.at)}</span>
                        <span className="ml-auto rounded-md border border-amber-400/30 px-1.5 py-0.5 text-[10px] text-amber-200/70">non commitée par Arcade</span>
                      </div>
                    ) : (
                      <div className="mb-1.5 flex items-center gap-2 text-[12px] text-white/55">
                        <History size={13} className="text-emerald-200/70" />
                        <span className="font-semibold text-white/80">upgrade #{num}</span>
                        <span className="text-white/35">{fmtDate(u.at)}</span>
                        <span className="ml-auto rounded-md border border-emerald-400/20 px-1.5 py-0.5 text-[10px] text-emerald-200/70">${(u.costUsd ?? 0).toFixed(4)}</span>
                        {u.commitHash && <span className="font-mono text-[10px] text-white/30">{u.commitHash}</span>}
                      </div>
                    )}
                    <UpgradeView u={u} isMd={isMd} onRestore={restore} restoring={restoring} />
                  </div>
                );
              });
            })()}
          </div>
        )}
    </Overlay>
  );
}
