// Phase 3 — boucle de feedback : mesure si l'exécution s'améliore session après session.
// Pour chaque classe de problème vue 2+ fois, on reconstruit la trajectoire chronologique de
// ses résolutions et on attribue à chaque rencontre une éventuelle injection (cwd + fenêtre
// temporelle, comme le bridge de notes). injectionLift = la mesure CAUSALE : fitness moyen
// des rencontres injectées − non injectées. Déterministe, zéro LLM. C'est la PREUVE du North Star.
import type {
  SessionSummary, InjectionLog, InjectionRecord, LearningEncounter,
  ClassLearningCurve, LearningData, TrendDirection,
} from "./types.ts";
import { problemKey } from "./canonical.ts";
import { computeFitness } from "./fitness.ts";

const INJECT_MARGIN = 120_000; // tolérance autour du début de session (rattachement injection)
const FITNESS_MARGIN = 0.02;   // seuil de tendance sur le delta de fitness

function realTs(s: SessionSummary): number {
  return s.startTs && s.startTs > 0 ? s.startTs : s.summarizedAt;
}

/** Vrai si une injection de `label` a touché le projet pendant la fenêtre de la session. */
function wasInjected(label: string, s: SessionSummary, records: InjectionRecord[]): boolean {
  const start = realTs(s) - INJECT_MARGIN;
  const end = (s.endTs && s.endTs > 0 ? s.endTs : realTs(s)) + INJECT_MARGIN;
  return records.some(
    (r) => r.cwd === s.project && r.at >= start && r.at <= end && r.categories.includes(label),
  );
}

interface Raw { label: string; encounters: LearningEncounter[]; }

/** Regroupe toutes les rencontres par classe canonique, chronologiques, avec attribution injection. */
function collect(summaries: SessionSummary[], log: InjectionLog): Map<string, Raw> {
  const records = log.records ?? [];
  const labelByKey = new Map<string, string>();
  const groups = new Map<string, Raw>();
  for (const s of summaries) {
    for (const p of s.problems ?? []) {
      const key = problemKey(p);
      if (!key) continue;
      const label = labelByKey.get(key) ?? p.category;
      labelByKey.set(key, label);
      const raw = groups.get(key) ?? { label, encounters: [] };
      raw.encounters.push({
        sessionId: s.sessionId, project: s.project, topic: s.topic, at: realTs(s),
        fitness: computeFitness(p.resolution_schema, s.quality_score, p.severity),
        turns: p.resolution_schema.turns_to_resolve,
        backtracks: p.resolution_schema.backtracks,
        outcome: p.resolution_schema.outcome,
        injected: wasInjected(label, s, records),
      });
      groups.set(key, raw);
    }
  }
  return groups;
}

function round3(n: number): number { return Math.round(n * 1000) / 1000; }

function trendOf(delta: number): TrendDirection {
  if (Math.abs(delta) <= FITNESS_MARGIN) return "flat";
  return delta > 0 ? "improving" : "worsening";
}

/** Construit la courbe d'une classe à partir de ses rencontres triées. */
function toCurve(classId: string, raw: Raw): ClassLearningCurve {
  const encounters = [...raw.encounters].sort((a, b) => a.at - b.at);
  const first = encounters[0]!;
  const last = encounters[encounters.length - 1]!;
  const fitnessDelta = round3(last.fitness - first.fitness);
  return {
    classId, label: raw.label, encounters,
    fitnessDelta,
    turnsDelta: last.turns - first.turns,
    injectedCount: encounters.filter((e) => e.injected).length,
    trend: trendOf(fitnessDelta),
  };
}

/** Lift causal : fitness moyen des rencontres injectées − non injectées (null si un groupe vide). */
function computeLift(curves: ClassLearningCurve[]): number | null {
  const all = curves.flatMap((c) => c.encounters);
  const inj = all.filter((e) => e.injected);
  const non = all.filter((e) => !e.injected);
  if (!inj.length || !non.length) return null;
  const avg = (xs: LearningEncounter[]): number => xs.reduce((a, e) => a + e.fitness, 0) / xs.length;
  return round3(avg(inj) - avg(non));
}

export function buildLearning(summaries: SessionSummary[], log: InjectionLog): LearningData {
  const groups = collect(summaries, log);
  const curves = [...groups.entries()]
    .map(([classId, raw]) => toCurve(classId, raw))
    .filter((c) => c.encounters.length >= 2) // récurrence = condition d'apprentissage observable
    .sort((a, b) => b.encounters.length - a.encounters.length);

  const improving = curves.filter((c) => c.trend === "improving").length;
  const worsening = curves.filter((c) => c.trend === "worsening").length;
  const avg = (xs: number[]): number => (xs.length ? round3(xs.reduce((a, v) => a + v, 0) / xs.length) : 0);
  return {
    generatedAt: Date.now(),
    recurringClasses: curves.length,
    improvingClasses: improving,
    worseningClasses: worsening,
    avgFitnessDelta: avg(curves.map((c) => c.fitnessDelta)),
    avgTurnsDelta: avg(curves.map((c) => c.turnsDelta)),
    injectedEncounters: curves.reduce((a, c) => a + c.injectedCount, 0),
    injectionLift: computeLift(curves),
    curves,
  };
}
