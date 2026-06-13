import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  SlidersHorizontal, GitCommitHorizontal, ShieldCheck, Lock, FileText,
  LayoutList, Radar, TriangleAlert, Archive, Ban, RotateCcw, EyeOff,
} from "lucide-react";
import {
  GitMerge, Power, Wand2, Plus, ArchiveX,
} from "lucide-react";
import type {
  ConfigTree, ConfigEntry, ConfigCommit, ConfigFile, CoverageReport, Proposal, AutoSettings,
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

const BLOCK_LABEL: Record<"env-failure" | "banned", string> = {
  "env-failure": "échec env — non créable", banned: "banni",
};

function GapCard({ g, onBan }: { g: CoverageReport["gaps"][number]; onBan: (id: string, b: boolean) => void }): React.JSX.Element {
  const tone = g.creatable ? "border-amber-400/15 bg-amber-400/[0.03]" : "border-white/[0.06] bg-white/[0.015] opacity-70";
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[13px] text-white/90">{g.className}</span>
        <span className="shrink-0 text-[11px] text-amber-200/80">{g.occurrences}× · {g.projects.length} projets</span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">{g.definition}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[10px] text-white/35">{g.projects.join(" · ")}</p>
        <div className="flex shrink-0 items-center gap-2">
          {g.block && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/45">{BLOCK_LABEL[g.block]}</span>}
          {g.creatable && (
            <button onClick={() => onBan(g.classId, true)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-white/40 hover:bg-white/[0.06] hover:text-white/70">
              <Ban size={11} /> bannir
            </button>
          )}
          {g.block === "banned" && (
            <button onClick={() => onBan(g.classId, false)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-fuchsia-200/70 hover:bg-white/[0.06]">
              <RotateCcw size={11} /> réautoriser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageView(): React.JSX.Element {
  const [data, setData] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try { setData((await (await fetch("/api/config/coverage")).json()) as CoverageReport); }
    catch (e: unknown) { setError(String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const ban = useCallback(async (classId: string, banned: boolean): Promise<void> => {
    try {
      await fetch("/api/config/banned", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, banned }),
      });
      await load();
    } catch (e: unknown) { setError(String(e)); }
  }, [load]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!data) return <PanelMessage text="Calcul de la couverture…" />;
  const creatable = data.gaps.filter((g) => g.creatable).length;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <section className="mb-8">
        <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <TriangleAlert size={15} className="text-amber-300" /> Gaps — classes récurrentes sans skill ({creatable} créables / {data.gaps.length})
        </h2>
        <p className="mb-3 text-[11px] text-white/40">≥4 occurrences, ≥2 projets, aucun skill ne couvre. Les échecs transitoires/env et les classes bannies ne sont pas créables.</p>
        {data.gaps.length === 0
          ? <p className="text-[12px] text-white/35">Aucun gap : tes classes récurrentes sont couvertes.</p>
          : <div className="flex flex-col gap-2">{data.gaps.map((g) => <GapCard key={g.classId} g={g} onBan={ban} />)}</div>}
      </section>
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <Archive size={15} className="text-white/45" /> Morts — skills jamais invoqués ({data.dead.filter((d) => d.archivable).length} archivables / {data.dead.length})
        </h2>
        <p className="mb-3 text-[11px] text-white/40">0 invocation via le tool Skill. Les agents et skills llm-* sont chargés silencieusement → jamais archivés auto.</p>
        {data.dead.length === 0
          ? <p className="text-[12px] text-white/35">Aucun skill mort détecté.</p>
          : <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {data.dead.map((d) => (
                <div key={d.relPath} className={`rounded-lg border px-3 py-2 ${d.silentLoad ? "border-white/[0.05] bg-white/[0.01] opacity-60" : "border-white/[0.07] bg-white/[0.02]"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-white/75">{d.name}</span>
                    {d.silentLoad && <EyeOff size={11} className="shrink-0 text-white/30" />}
                  </div>
                  <p className="text-[10px] text-white/35">{d.invocations} invoc.{d.silentLoad ? " · silencieux" : ""}</p>
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}

const KIND_ICON: Record<Proposal["kind"], typeof Wand2> = { patch: Wand2, create: Plus, archive: ArchiveX };
const KIND_TONE: Record<Proposal["kind"], string> = {
  patch: "text-sky-300", create: "text-emerald-300", archive: "text-white/45",
};
const STATUS_TONE: Record<Proposal["status"], string> = {
  pending: "bg-amber-400/10 text-amber-200", applied: "bg-emerald-400/10 text-emerald-300",
  rejected: "bg-white/[0.06] text-white/40", failed: "bg-rose-400/10 text-rose-300",
};

function Toggle({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: string; hint?: string }): React.JSX.Element {
  return (
    <button onClick={onToggle} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.04]">
      <div>
        <p className="text-[12px] text-white/80">{label}</p>
        {hint && <p className="text-[10px] text-white/35">{hint}</p>}
      </div>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-fuchsia-500/70" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function EvolutionView(): React.JSX.Element {
  const [settings, setSettings] = useState<AutoSettings | null>(null);
  const [props, setProps] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [s, p] = await Promise.all([fetch("/api/config/settings"), fetch("/api/config/proposals")]);
      setSettings((await s.json()) as AutoSettings);
      setProps((await p.json()) as Proposal[]);
    } catch (e: unknown) { setError(String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const [busy, setBusy] = useState(false);

  const patch = useCallback(async (p: Partial<AutoSettings>): Promise<void> => {
    try {
      const r = await fetch("/api/config/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
      });
      setSettings((await r.json()) as AutoSettings);
    } catch (e: unknown) { setError(String(e)); }
  }, []);

  const applyOne = useCallback(async (id: string): Promise<void> => {
    setBusy(true);
    try {
      await fetch("/api/config/proposals/apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      await load();
    } catch (e: unknown) { setError(String(e)); } finally { setBusy(false); }
  }, [load]);

  const runAll = useCallback(async (): Promise<void> => {
    setBusy(true);
    try { await fetch("/api/config/evolve", { method: "POST" }); await load(); }
    catch (e: unknown) { setError(String(e)); } finally { setBusy(false); }
  }, [load]);

  if (error) return <PanelMessage text={`Erreur : ${error}`} />;
  if (!settings || !props) return <PanelMessage text="Chargement…" />;
  const pending = props.filter((p) => p.status === "pending").length;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <section className="mb-7 max-w-xl">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-white/85">
          <Power size={15} className={settings.autoGenerate ? "text-fuchsia-300" : "text-white/30"} /> Évolution automatique
        </h2>
        <div className="flex flex-col gap-2">
          <Toggle on={settings.autoGenerate} onToggle={() => void patch({ autoGenerate: !settings.autoGenerate })}
            label="Auto-génération (kill-switch global)" hint="Coupe toute écriture auto. Détection toujours active." />
          <div className="grid grid-cols-3 gap-2">
            <Toggle on={settings.autoPatch} onToggle={() => void patch({ autoPatch: !settings.autoPatch })} label="Patch" />
            <Toggle on={settings.autoCreate} onToggle={() => void patch({ autoCreate: !settings.autoCreate })} label="Création" />
            <Toggle on={settings.autoArchive} onToggle={() => void patch({ autoArchive: !settings.autoArchive })} label="Archivage" />
          </div>
          <p className="px-1 text-[10px] text-white/35">Cap anti-batch : {settings.maxPerCycle} générations max / cycle (North Star).</p>
        </div>
      </section>
      <section>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white/85">
            <GitMerge size={15} className="text-fuchsia-200" /> Propositions ({pending} en attente / {props.length})
          </h2>
          {pending > 0 && (
            <button onClick={() => void runAll()} disabled={busy}
              className="rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-[12px] text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:opacity-40">
              {busy ? "…" : "Lancer maintenant"}
            </button>
          )}
        </div>
        <p className="mb-3 text-[11px] text-white/40">Diplômées des consolidations : patch (principe confiant + jugé), création (gap créable), archivage (mort). Snapshot + commit git avant chaque écriture.</p>
        {props.length === 0
          ? <p className="text-[12px] text-white/35">Aucune proposition pour l'instant.</p>
          : <div className="flex flex-col gap-2">
              {props.map((p) => {
                const Icon = KIND_ICON[p.kind];
                return (
                  <div key={p.id} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <Icon size={15} className={`mt-0.5 shrink-0 ${KIND_TONE[p.kind]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] text-white/85">{p.title}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {p.status === "pending" && (
                            <button onClick={() => void applyOne(p.id)} disabled={busy}
                              className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70 hover:bg-white/[0.12] disabled:opacity-40">
                              appliquer
                            </button>
                          )}
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${STATUS_TONE[p.status]}`}>{p.status}</span>
                        </div>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{p.rationale}</p>
                      {p.targetRel && <p className="mt-1 font-mono text-[10px] text-white/30">{p.targetRel}</p>}
                      {p.commitHash && <p className="mt-1 text-[10px] text-emerald-300/60">commit {p.commitHash}</p>}
                      {p.note && <p className="mt-1 text-[10px] text-rose-300/60">{p.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>}
      </section>
    </div>
  );
}

export function ConfigPanel(): React.JSX.Element {
  const [mode, setMode] = useState<"files" | "coverage" | "evolution">("files");
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
        <ModeBtn active={mode === "evolution"} onClick={() => setMode("evolution")} Icon={GitMerge} label="Auto-évolution" />
      </div>
      {mode === "evolution" ? <EvolutionView /> : mode === "coverage" ? <CoverageView /> : (
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
