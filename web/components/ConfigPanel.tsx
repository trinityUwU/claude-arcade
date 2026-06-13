import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  SlidersHorizontal, GitCommitHorizontal, ShieldCheck, Lock, FileText,
  LayoutList, Radar, TriangleAlert, Archive,
} from "lucide-react";
import type {
  ConfigTree, ConfigEntry, ConfigCommit, ConfigFile, CoverageReport,
} from "../../src/config/types.ts";
import type { SkillUsage } from "../../src/types.ts";
import { PanelMessage } from "./SessionsPanel.tsx";

const KIND_LABEL: Record<ConfigEntry["kind"], string> = {
  instruction: "Instructions", skill: "Skills", command: "Commandes", setting: "Réglages",
};
const KIND_ORDER: ConfigEntry["kind"][] = ["instruction", "skill", "command", "setting"];

function EntryRow(
  { e, active, uses, onClick }:
  { e: ConfigEntry; active: boolean; uses?: number; onClick: () => void },
): React.JSX.Element {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors
        ${active ? "nav-active" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"}`}>
      <span className="flex-1 truncate font-mono">{e.name}</span>
      {e.managed && <ShieldCheck size={12} className="shrink-0 text-emerald-300/70" />}
      {!e.patchable && <Lock size={12} className="shrink-0 text-white/25" />}
      {uses !== undefined && uses > 0 && <span className="shrink-0 text-[10px] tabular-nums text-fuchsia-200/70">{uses}×</span>}
    </button>
  );
}

function HistoryList({ commits }: { commits: ConfigCommit[] }): React.JSX.Element {
  if (!commits.length) return <p className="text-[12px] text-white/35">Aucun commit versionné pour ce fichier.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {commits.map((c) => (
        <div key={c.hash} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <GitCommitHorizontal size={13} className="mt-0.5 shrink-0 text-white/30" />
          <div className="min-w-0">
            <p className="truncate text-[12px] text-white/75">{c.subject}</p>
            <p className="text-[10px] text-white/35">{new Date(c.date).toLocaleString("fr")} · {c.hash.slice(0, 8)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Detail({ entry, file, history }: { entry: ConfigEntry; file: ConfigFile | null; history: ConfigCommit[] }): React.JSX.Element {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-[14px] text-white/90">{entry.name}</h2>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/45">{entry.relPath}</span>
          {entry.managed
            ? <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-300">managé</span>
            : null}
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${entry.patchable ? "bg-fuchsia-400/10 text-fuchsia-200" : "bg-white/[0.05] text-white/40"}`}>
            {entry.patchable ? "évolutif par Arcade" : "lecture seule"}
          </span>
        </div>
        {entry.description && <p className="mt-2 text-[12px] leading-relaxed text-white/55">{entry.description}</p>}
      </div>
      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">Historique git</h3>
        <HistoryList commits={history} />
      </section>
      <section className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">Contenu · {entry.bytes.toLocaleString("fr")} c.</h3>
        <pre className="flex-1 overflow-auto rounded-xl border border-white/[0.07] bg-black/30 p-4 text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap">
          {file ? file.content : "Chargement…"}
        </pre>
      </section>
    </motion.div>
  );
}

function ModeBtn(
  { active, onClick, Icon, label }:
  { active: boolean; onClick: () => void; Icon: typeof LayoutList; label: string },
): React.JSX.Element {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-colors
        ${active ? "nav-active" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function CoverageView(): React.JSX.Element {
  const [data, setData] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/config/coverage")
      .then(async (r) => setData((await r.json()) as CoverageReport))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Calcul de la couverture…" />;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <section className="mb-8">
        <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <TriangleAlert size={15} className="text-amber-300" /> Gaps — classes récurrentes sans skill ({data.gaps.length})
        </h2>
        <p className="mb-3 text-[11px] text-white/40">Candidates à création (≥4 occurrences, ≥2 projets, aucun skill ne couvre).</p>
        {data.gaps.length === 0
          ? <p className="text-[12px] text-white/35">Aucun gap : tes classes récurrentes sont couvertes.</p>
          : <div className="flex flex-col gap-2">
              {data.gaps.map((g) => (
                <div key={g.classId} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[13px] text-white/90">{g.className}</span>
                    <span className="shrink-0 text-[11px] text-amber-200/80">{g.occurrences}× · {g.projects.length} projets</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/55">{g.definition}</p>
                  <p className="mt-1.5 text-[10px] text-white/35">{g.projects.join(" · ")}</p>
                </div>
              ))}
            </div>}
      </section>
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <Archive size={15} className="text-white/45" /> Morts — skills jamais invoqués ({data.dead.length})
        </h2>
        <p className="mb-3 text-[11px] text-white/40">0 invocation via le tool Skill = signal d'archivage (pas un verdict : certains skills sont chargés silencieusement).</p>
        {data.dead.length === 0
          ? <p className="text-[12px] text-white/35">Aucun skill mort détecté.</p>
          : <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {data.dead.map((d) => (
                <div key={d.relPath} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <span className="font-mono text-[12px] text-white/75">{d.name}</span>
                  <p className="text-[10px] text-white/35">{d.invocations} invoc.</p>
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}

export function ConfigPanel(): React.JSX.Element {
  const [mode, setMode] = useState<"files" | "coverage">("files");
  const [tree, setTree] = useState<ConfigTree | null>(null);
  const [skills, setSkills] = useState<SkillUsage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [file, setFile] = useState<ConfigFile | null>(null);
  const [history, setHistory] = useState<ConfigCommit[]>([]);

  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const [t, s] = await Promise.all([fetch("/api/config"), fetch("/api/skills")]);
        setTree((await t.json()) as ConfigTree);
        setSkills((await s.json()) as SkillUsage[]);
      } catch (e: unknown) { setError(String(e)); }
    })();
  }, []);

  const pick = useCallback(async (rel: string): Promise<void> => {
    setSel(rel); setFile(null); setHistory([]);
    try {
      const q = `?path=${encodeURIComponent(rel)}`;
      const [f, h] = await Promise.all([fetch(`/api/config/file${q}`), fetch(`/api/config/history${q}`)]);
      setFile((await f.json()) as ConfigFile);
      setHistory((await h.json()) as ConfigCommit[]);
    } catch (e: unknown) { setError(String(e)); }
  }, []);

  const usesByName = useMemo(() => new Map(skills.map((s) => [s.name, s.count])), [skills]);
  const groups = useMemo(() => KIND_ORDER
    .map((k) => ({ kind: k, items: tree?.entries.filter((e) => e.kind === k) ?? [] }))
    .filter((g) => g.items.length), [tree]);
  const selected = tree?.entries.find((e) => e.relPath === sel) ?? null;

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!tree) return <PanelMessage text="Chargement…" />;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-white/[0.07] px-4 py-2.5">
        <ModeBtn active={mode === "files"} onClick={() => setMode("files")} Icon={LayoutList} label="Fichiers" />
        <ModeBtn active={mode === "coverage"} onClick={() => setMode("coverage")} Icon={Radar} label="Couverture" />
      </div>
      {mode === "coverage" ? <CoverageView /> : (
      <div className="flex flex-1 overflow-hidden">
      <div className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/[0.07] px-3 py-5">
        <header className="mb-3 flex items-center gap-2 px-1">
          <SlidersHorizontal size={18} className="text-fuchsia-200" />
          <div>
            <h1 className="text-sm font-bold text-white/90">Config Claude Code</h1>
            <p className="text-[11px] text-white/40">
              {tree.entries.length} fichiers · {tree.versioned ? "versionné" : "non versionné"}
            </p>
          </div>
        </header>
        {groups.map((g) => (
          <div key={g.kind} className="mb-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              {KIND_LABEL[g.kind]} · {g.items.length}
            </div>
            {g.items.map((e) => (
              <EntryRow key={e.relPath} e={e} active={sel === e.relPath}
                uses={usesByName.get(e.name)} onClick={() => void pick(e.relPath)} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-hidden px-8 py-6">
        {selected
          ? <Detail entry={selected} file={file} history={history} />
          : <div className="flex h-full flex-col items-center justify-center gap-2 text-white/35">
              <FileText size={28} strokeWidth={1.5} />
              <p className="text-[13px]">Sélectionne un fichier de config.</p>
            </div>}
      </div>
      </div>
      )}
    </div>
  );
}
