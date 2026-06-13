// Couche (B) — principes : regroupe les process de pensée par domaine, mesure leur
// confiance (croît avec la récurrence), détecte les contradictions. Déterministe, zéro LLM.
import type {
  SessionSummary, Principle, PrinciplePolarity,
  PrincipleInstance, PrincipleEntry, PrinciplesData, JudgmentsData,
} from "./types.ts";
import { groupingKey, normalizeText } from "./text-normalize.ts";

function toInstance(s: SessionSummary, p: Principle): PrincipleInstance {
  return {
    sessionId: s.sessionId,
    project: s.project,
    principleId: p.id,
    statement: p.statement,
    domain: p.domain,
    trigger: p.trigger,
    polarity: p.polarity,
    source: p.source,
    rationale: p.rationale,
    sessionQuality: s.quality_score,
    at: s.summarizedAt,
  };
}

/** Contesté = un même énoncé (clé normalisée) porte à la fois positive et negative. */
function detectContested(instances: PrincipleInstance[]): boolean {
  const polByStatement = new Map<string, Set<PrinciplePolarity>>();
  for (const inst of instances) {
    const key = groupingKey(inst.statement) || inst.statement;
    const set = polByStatement.get(key) ?? new Set<PrinciplePolarity>();
    set.add(inst.polarity);
    polByStatement.set(key, set);
  }
  for (const set of polByStatement.values()) if (set.size > 1) return true;
  return false;
}

function dominantPolarity(instances: PrincipleInstance[]): PrinciplePolarity {
  const pos = instances.filter((i) => i.polarity === "positive").length;
  return pos >= instances.length - pos ? "positive" : "negative";
}

/** Énoncés normalisés distincts d'un domaine — la matière comparable du jugement. */
export function distinctStatements(instances: PrincipleInstance[]): string[] {
  return [...new Set(instances.map((i) => normalizeText(i.statement)).filter(Boolean))];
}

/** Empreinte déterministe des instances : change ⇔ la matière à juger a changé. */
function domainSignature(instances: PrincipleInstance[]): string {
  return [...instances]
    .map((i) => `${normalizeText(i.statement)}|${i.polarity}`)
    .sort()
    .join("§");
}

/** Un domaine mérite un jugement LLM dès qu'il oppose 2+ énoncés distincts. */
export function eligibleForJudgment(entry: PrincipleEntry): boolean {
  return distinctStatements(entry.instances).length >= 2;
}

function buildEntry(domain: string, instances: PrincipleInstance[]): PrincipleEntry {
  const recent = [...instances].sort((a, b) => b.at - a.at);
  const polarity = dominantPolarity(instances);
  const contested = detectContested(instances);
  const occ = instances.length;
  const base = 1 - 1 / (1 + occ);
  const confidence = Math.round(base * (contested ? 0.5 : 1) * 1000) / 1000;
  const representative = recent.find((i) => i.polarity === polarity) ?? recent[0];
  const label = [...instances].map((i) => i.domain).sort((a, b) => a.length - b.length)[0] ?? domain;
  return {
    domain,
    label,
    statement: representative?.statement ?? "",
    polarity,
    occurrences: occ,
    confidence,
    contested,
    statedCount: instances.filter((i) => i.source === "stated").length,
    signature: domainSignature(instances),
    instances: recent,
  };
}

/** Réattache un jugement persisté seulement si sa signature matche encore l'état du domaine. */
function attachJudgment(entry: PrincipleEntry, judgments?: JudgmentsData): PrincipleEntry {
  const j = judgments?.byDomain[entry.domain];
  return j && j.signature === entry.signature ? { ...entry, judgment: j } : entry;
}

export function buildPrinciples(summaries: SessionSummary[], judgments?: JudgmentsData): PrinciplesData {
  const groups = new Map<string, PrincipleInstance[]>();
  for (const s of summaries) {
    for (const p of s.principles ?? []) { // résumés v1/v2 sans principles → ignorés
      const key = groupingKey(p.domain);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(toInstance(s, p));
      groups.set(key, list);
    }
  }
  const domains = [...groups.entries()]
    .map(([domain, instances]) => attachJudgment(buildEntry(domain, instances), judgments))
    .sort((a, b) => b.occurrences - a.occurrences || b.confidence - a.confidence);
  return { generatedAt: Date.now(), domains };
}
