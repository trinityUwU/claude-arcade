// Détection déterministe (zéro token) des propositions d'évolution config qui ont « diplômé » :
// patches (principes confiants + jugés → skill ciblé), créations (gaps créables), archivages (morts).
import { normalizeText } from "../consolidate/text-normalize.ts";
import type { PrinciplesData } from "../consolidate/types.ts";
import type { ConfigEntry, CoverageReport, Proposal } from "./types.ts";

// Gate de graduation d'un principe en patch : confiance haute, non contesté, jugé par le LLM.
const PATCH_MIN_CONF = 0.7;
const TARGET_MIN_OVERLAP = 2;

function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter((w) => w.length >= 4));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

/** Skill patchable le plus proche d'un principe (token-overlap), ou null si aucun ne dépasse le seuil. */
function bestSkill(text: string, skills: ConfigEntry[]): ConfigEntry | null {
  const ctok = tokenize(text);
  let best: ConfigEntry | null = null;
  let bestScore = TARGET_MIN_OVERLAP - 1;
  for (const s of skills) {
    const score = overlap(ctok, tokenize(`${s.name} ${s.description ?? ""}`));
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

function patchProposals(principles: PrinciplesData, skills: ConfigEntry[]): Proposal[] {
  const out: Proposal[] = [];
  for (const d of principles.domains) {
    if (d.contested || d.confidence < PATCH_MIN_CONF || !d.judgment) continue;
    const target = bestSkill(`${d.label} ${d.statement}`, skills);
    if (!target) continue;
    out.push({
      id: `patch:${d.domain}`, kind: "patch", title: `Évoluer ${target.name}`,
      rationale: d.statement, sourceKey: d.domain, targetRel: target.relPath,
      confidence: d.confidence, status: "pending", createdAt: Date.now(),
    });
  }
  return out;
}

export function buildGraduation(
  principles: PrinciplesData, coverage: CoverageReport, entries: ConfigEntry[],
): Proposal[] {
  const skills = entries.filter((e) => e.kind === "skill" && e.patchable);
  const out = patchProposals(principles, skills);
  for (const g of coverage.gaps) {
    if (!g.creatable) continue;
    out.push({
      id: `create:${g.classId}`, kind: "create", title: `Créer un skill : ${g.className}`,
      rationale: g.definition, sourceKey: g.classId, status: "pending", createdAt: Date.now(),
    });
  }
  for (const d of coverage.dead) {
    if (!d.archivable) continue;
    out.push({
      id: `archive:${d.name}`, kind: "archive", title: `Archiver ${d.name}`,
      rationale: `0 invocation via le tool Skill`, sourceKey: d.name, targetRel: d.relPath,
      status: "pending", createdAt: Date.now(),
    });
  }
  return out;
}

/** Fusionne les candidats live avec le journal persisté : un id déjà traité garde son statut. */
export function mergeWithJournal(live: Proposal[], journal: Proposal[]): Proposal[] {
  const byId = new Map(journal.map((p) => [p.id, p]));
  const merged = live.map((c) => {
    const past = byId.get(c.id);
    return past && past.status !== "pending" ? past : c;
  });
  const liveIds = new Set(live.map((p) => p.id));
  const historical = journal.filter((p) => !liveIds.has(p.id) && p.status !== "pending");
  return [...merged, ...historical];
}
