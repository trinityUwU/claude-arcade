// Couche 2 — évolution : séries temporelles hebdomadaires pour mesurer si le
// système d'apprentissage progresse (recurrence ↓, fitness champions ↑). Déterministe, zéro LLM.
import type {
  SessionSummary, ChampionsData, EvolutionBucket, EvolutionData,
  TrendDirection,
} from "./types.ts";
import { groupingKey } from "./text-normalize.ts";

const DAY = 86_400_000;

/** Début (lundi 00:00 local) de la semaine ISO contenant `at`. */
function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const iso = (d.getDay() + 6) % 7; // lundi = 0
  return d.getTime() - iso * DAY;
}

/** Libellé "YYYY-Www" de la semaine ISO du jeudi de la semaine de `start`. */
function weekKey(start: number): string {
  const thu = new Date(start + 3 * DAY);
  const year = thu.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.floor((thu.getTime() - jan1.getTime()) / (7 * DAY)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

interface RawBucket {
  start: number;
  sessions: SessionSummary[];
  problems: number;
  recurring: number;
}

/** Marque chaque problème "recurring" si sa catégorie fut déjà vue avant (chronologie globale). */
function computeRecurrence(summaries: SessionSummary[]): Map<string, number> {
  const flat: Array<{ key: string; at: number; week: number }> = [];
  for (const s of summaries) {
    for (const p of s.problems ?? []) {
      const key = groupingKey(p.category);
      if (key) flat.push({ key, at: s.summarizedAt, week: weekStart(s.summarizedAt) });
    }
  }
  flat.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  const byWeek = new Map<string, number>();
  for (const p of flat) {
    if (seen.has(p.key)) byWeek.set(`${p.week}`, (byWeek.get(`${p.week}`) ?? 0) + 1);
    seen.add(p.key);
  }
  return byWeek;
}

/** Regroupe les sessions valides en buckets hebdo, comptant problèmes et récurrences. */
function bucketize(summaries: SessionSummary[]): RawBucket[] {
  const valid = summaries.filter((s) => s.summarizedAt > 0);
  const recurring = computeRecurrence(valid);
  const by = new Map<number, RawBucket>();
  for (const s of valid) {
    const start = weekStart(s.summarizedAt);
    const b = by.get(start) ?? { start, sessions: [], problems: 0, recurring: recurring.get(`${start}`) ?? 0 };
    b.sessions.push(s);
    b.problems += (s.problems ?? []).filter((p) => groupingKey(p.category)).length;
    by.set(start, b);
  }
  return [...by.values()].sort((a, b) => a.start - b.start);
}

/** Moyenne du meilleur fitness connu par catégorie pour les instances `at <= endTime`. */
function fitnessAt(champions: ChampionsData, endTime: number): number {
  const best = new Map<string, number>();
  for (const cat of champions.categories) {
    for (const inst of cat.contenders) {
      if (inst.at > endTime) continue;
      best.set(cat.category, Math.max(best.get(cat.category) ?? -Infinity, inst.fitness));
    }
  }
  const vals = [...best.values()];
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 1000) / 1000;
}

/** Compte easy/medium/hard des sessions d'un bucket. */
function difficultyOf(sessions: SessionSummary[]): EvolutionBucket["difficulty"] {
  const d = { easy: 0, medium: 0, hard: 0 };
  for (const s of sessions) { const lvl = s.difficulty?.level; if (lvl) d[lvl] += 1; } // v1 sans difficulty → ignoré
  return d;
}

function toBucket(raw: RawBucket, champions: ChampionsData): EvolutionBucket {
  const n = raw.sessions.length;
  const end = raw.start + 7 * DAY - 1;
  const avgQuality = Math.round(raw.sessions.reduce((a, s) => a + s.quality_score, 0) / n);
  const recurrenceRate = raw.problems ? Math.round((raw.recurring / raw.problems) * 100) / 100 : 0;
  return {
    period: weekKey(raw.start),
    start: raw.start,
    sessions: n,
    avgQuality,
    problems: raw.problems,
    recurringProblems: raw.recurring,
    recurrenceRate,
    avgChampionFitness: fitnessAt(champions, end),
    difficulty: difficultyOf(raw.sessions),
  };
}

/** Tendance entre premier et dernier bucket selon une marge ; `higherIsBetter` inverse le sens. */
function trend(first: number, last: number, margin: number, higherIsBetter: boolean): TrendDirection {
  const delta = last - first;
  if (Math.abs(delta) <= margin) return "flat";
  const up = delta > 0;
  return up === higherIsBetter ? "improving" : "worsening";
}

function globalRecurrence(buckets: EvolutionBucket[]): number {
  const recurring = buckets.reduce((a, b) => a + b.recurringProblems, 0);
  const problems = buckets.reduce((a, b) => a + b.problems, 0);
  return problems ? Math.round((recurring / problems) * 100) / 100 : 0;
}

function globalFitness(champions: ChampionsData): number {
  const vals = champions.categories
    .map((c) => c.champion?.fitness)
    .filter((f): f is number => f != null);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 1000) / 1000;
}

export function buildEvolution(summaries: SessionSummary[], champions: ChampionsData): EvolutionData {
  const buckets = bucketize(summaries).map((raw) => toBucket(raw, champions));
  const enough = buckets.length >= 2;
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  return {
    generatedAt: Date.now(),
    buckets,
    overallRecurrenceRate: globalRecurrence(buckets),
    recurrenceTrend: enough ? trend(first!.recurrenceRate, last!.recurrenceRate, 0.05, false) : "flat",
    avgChampionFitness: globalFitness(champions),
    fitnessTrend: enough ? trend(first!.avgChampionFitness, last!.avgChampionFitness, 0.02, true) : "flat",
  };
}
