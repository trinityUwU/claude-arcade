// Couche 2 — champions : élit le meilleur schéma de résolution par catégorie de
// problème, conserve la lignée (history). Sélection darwinienne, déterministe, zéro LLM.
import type {
  SessionSummary, Problem, SchemaInstance, ChampionEntry,
  ChampionsData, ChampionHistoryPoint, CanonicalRegistry,
} from "./types.ts";
import { problemKey, emptyRegistry } from "./canonical.ts";
import { computeFitness } from "./fitness.ts";

function toInstance(s: SessionSummary, p: Problem): SchemaInstance {
  return {
    sessionId: s.sessionId,
    project: s.project,
    problemId: p.id,
    description: p.description,
    category: p.category,
    severity: p.severity,
    resolution: p.resolution_schema,
    fitness: computeFitness(p.resolution_schema, s.quality_score),
    sessionQuality: s.quality_score,
    at: s.summarizedAt,
  };
}

function computeHistory(instances: SchemaInstance[]): ChampionHistoryPoint[] {
  const chrono = [...instances].sort((a, b) => a.at - b.at);
  const history: ChampionHistoryPoint[] = [];
  let best = -Infinity;
  for (const inst of chrono) {
    if (inst.fitness > best) {
      best = inst.fitness;
      history.push({ sessionId: inst.sessionId, fitness: inst.fitness, at: inst.at });
    }
  }
  return history;
}

function buildEntry(category: string, instances: SchemaInstance[], label: string): ChampionEntry {
  const contenders = [...instances].sort((a, b) => b.fitness - a.fitness);
  const champion = contenders.find((i) => i.resolution.outcome !== "unresolved") ?? null;
  const resolved = instances.filter((i) => i.resolution.outcome === "resolved").length;
  return {
    category,
    label,
    champion,
    contenders,
    occurrences: instances.length,
    resolvedRate: Math.round((resolved / instances.length) * 100) / 100,
    history: computeHistory(instances),
  };
}

/** Regroupe par classe canonique (problemKey) ; le label = nom canonique si connu,
 *  sinon la catégorie la plus courte du groupe (fallback résumés v1-v3). */
export function buildChampions(summaries: SessionSummary[], registry: CanonicalRegistry = emptyRegistry()): ChampionsData {
  const nameById = new Map(registry.classes.map((c) => [c.id, c.name]));
  const groups = new Map<string, SchemaInstance[]>();
  for (const s of summaries) {
    for (const p of s.problems ?? []) { // résumés v1 (pré-schéma) sans problems → ignorés
      const key = problemKey(p);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(toInstance(s, p));
      groups.set(key, list);
    }
  }
  const categories = [...groups.entries()]
    .map(([category, instances]) => {
      const label = nameById.get(category)
        ?? [...instances].map((i) => i.category).sort((a, b) => a.length - b.length)[0]
        ?? category;
      return buildEntry(category, instances, label);
    })
    .sort((a, b) => b.occurrences - a.occurrences);
  return { generatedAt: Date.now(), categories };
}
