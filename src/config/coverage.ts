// Couverture skills (déterministe, zéro token) : classes canoniques récurrentes sans skill (gaps
// à créer) + skills jamais invoqués (morts, candidats archivage). Surface lue à la demande par l'API.
import { normalizeText } from "../consolidate/text-normalize.ts";
import type { SessionSummary, CanonicalRegistry, ChampionsData } from "../consolidate/types.ts";
import type { SkillUsage } from "../types.ts";
import type { ConfigEntry, CoverageReport, CoverageGap, CoverageDeadSkill, GapBlock } from "./types.ts";

// Gate de gap : une classe ne devient candidate à création que si bien établie ET cross-projet.
const MIN_OCC = 4;
const MIN_PROJECTS = 2;
// Une classe est « couverte » si un skill partage ≥ ce nombre de tokens significatifs avec elle.
const COVER_THRESHOLD = 2;

// Marqueurs d'échec transitoire/environnement : ces classes ne doivent JAMAIS devenir des skills
// (anti-pattern CLAUDE.md — elles se durcissent en fausses contraintes). Accent-free (cf. normalizeText).
const ENV_MARKERS = [
  "permission", "denied", "accorde", "introuvable", "not found", "command not found",
  "install", "manquant", "missing", "credential", "identifiant", "timeout",
  "binaire", "package", "env var", "variable d env", "404", "unauthorized", "forbidden", "scope",
];

function isEnvFailure(name: string, definition: string): boolean {
  const t = normalizeText(`${name} ${definition}`);
  return ENV_MARKERS.some((m) => t.includes(m));
}

/** Agents et skills llm-* sont chargés silencieusement (pas via le tool Skill) → 0 invoc. normal. */
function isSilentLoad(name: string): boolean {
  return name.startsWith("llm-") || name.endsWith("-agent") || name === "mira";
}

function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter((w) => w.length >= 4));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function projectsByClass(summaries: SessionSummary[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of summaries) {
    for (const p of s.problems ?? []) {
      if (!p.canonicalClassId) continue;
      const set = out.get(p.canonicalClassId) ?? new Set<string>();
      if (s.project) set.add(s.project);
      out.set(p.canonicalClassId, set);
    }
  }
  return out;
}

function findGaps(
  registry: CanonicalRegistry, champions: ChampionsData,
  skillTokens: Set<string>[], byClass: Map<string, Set<string>>, banned: Set<string>,
): CoverageGap[] {
  const fitnessByName = new Map(champions.categories.map((c) => [c.label, c.champion?.fitness ?? null]));
  const gaps: CoverageGap[] = [];
  for (const cls of registry.classes) {
    const projects = [...(byClass.get(cls.id) ?? new Set<string>())];
    if (cls.occurrences < MIN_OCC || projects.length < MIN_PROJECTS) continue;
    const ctok = tokenize(`${cls.name} ${cls.definition}`);
    if (skillTokens.some((st) => overlap(ctok, st) >= COVER_THRESHOLD)) continue; // couvert
    const block: GapBlock = banned.has(cls.id) ? "banned"
      : isEnvFailure(cls.name, cls.definition) ? "env-failure" : null;
    gaps.push({
      classId: cls.id, className: cls.name, definition: cls.definition,
      occurrences: cls.occurrences, projects, championFitness: fitnessByName.get(cls.name) ?? null,
      creatable: block === null, block,
    });
  }
  return gaps.sort((a, b) => Number(b.creatable) - Number(a.creatable) || b.occurrences - a.occurrences);
}

function findDead(entries: ConfigEntry[], usage: SkillUsage[]): CoverageDeadSkill[] {
  const byName = new Map(usage.map((u) => [u.name, u]));
  return entries
    .filter((e) => e.kind === "skill" && e.patchable)
    .map((e) => ({ e, u: byName.get(e.name) }))
    .filter((x) => !x.u || x.u.count === 0)
    .map((x) => {
      const silentLoad = isSilentLoad(x.e.name);
      return {
        name: x.e.name, relPath: x.e.relPath, invocations: x.u?.count ?? 0,
        sessions: x.u?.sessions ?? 0, silentLoad, archivable: !silentLoad,
      };
    })
    .sort((a, b) => Number(b.archivable) - Number(a.archivable));
}

export function buildCoverage(
  summaries: SessionSummary[],
  registry: CanonicalRegistry,
  champions: ChampionsData,
  skillUsage: SkillUsage[],
  configEntries: ConfigEntry[],
  bannedClassIds: string[] = [],
): CoverageReport {
  const skillTokens = configEntries
    .filter((e) => e.kind === "skill")
    .map((e) => tokenize(`${e.name} ${e.description ?? ""}`));
  return {
    generatedAt: Date.now(),
    gaps: findGaps(registry, champions, skillTokens, projectsByClass(summaries), new Set(bannedClassIds)),
    dead: findDead(configEntries, skillUsage),
  };
}
