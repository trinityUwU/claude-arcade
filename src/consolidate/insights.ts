// Couche 2 — insights : regroupe les résumés en bilans projet, erreurs/process
// récurrents et notions dominantes. Déterministe, zéro LLM.
import type { SessionSummary, Insights, ProjectRollup, RecurringItem } from "./types.ts";
import { groupingKey, notionKey } from "./text-normalize.ts";

interface Bucket { texts: string[]; projects: Set<string>; sessions: Set<string> }

/** Regroupe des phrases libres par clé de similarité → items récurrents (count ≥ 2). */
function recurring(entries: Array<{ text: string; project: string; session: string }>): RecurringItem[] {
  const buckets = new Map<string, Bucket>();
  for (const e of entries) {
    const key = groupingKey(e.text);
    if (!key) continue;
    const b = buckets.get(key) ?? { texts: [], projects: new Set(), sessions: new Set() };
    b.texts.push(e.text);
    b.projects.add(e.project);
    b.sessions.add(e.session);
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .filter((b) => b.sessions.size >= 2)
    .map((b) => ({
      text: b.texts.sort((x, y) => x.length - y.length)[0] ?? "",
      count: b.sessions.size, projects: [...b.projects], sessions: [...b.sessions],
    }))
    .sort((a, b) => b.count - a.count);
}

function collect(
  summaries: SessionSummary[], pick: (s: SessionSummary) => string[],
): Array<{ text: string; project: string; session: string }> {
  const out: Array<{ text: string; project: string; session: string }> = [];
  for (const s of summaries) for (const text of pick(s)) out.push({ text, project: s.project, session: s.sessionId });
  return out;
}

function rollupProjects(summaries: SessionSummary[]): ProjectRollup[] {
  const by = new Map<string, SessionSummary[]>();
  for (const s of summaries) {
    const k = s.project || "(inconnu)";
    const list = by.get(k) ?? [];
    list.push(s);
    by.set(k, list);
  }
  return [...by.entries()].map(([project, list]) => ({
    project,
    sessions: list.length,
    avgQuality: Math.round(list.reduce((a, s) => a + s.quality_score, 0) / list.length),
    topNotions: topNotions(list, 5).map((n) => n.text),
  })).sort((a, b) => b.sessions - a.sessions);
}

function topNotions(summaries: SessionSummary[], limit: number): Array<{ text: string; count: number }> {
  const freq = new Map<string, number>();
  for (const s of summaries) {
    for (const hint of new Set(s.links_hint.map(notionKey))) {
      if (hint) freq.set(hint, (freq.get(hint) ?? 0) + 1);
    }
  }
  return [...freq.entries()].map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count).slice(0, limit);
}

export function buildInsights(summaries: SessionSummary[]): Insights {
  return {
    generatedAt: Date.now(),
    sessionCount: summaries.length,
    projects: rollupProjects(summaries),
    recurringErrorsClaude: recurring(collect(summaries, (s) => s.errors_claude)),
    recurringErrorsChris: recurring(collect(summaries, (s) => s.errors_chris)),
    winningProcesses: recurring(collect(summaries, (s) => s.wins)),
    topNotions: topNotions(summaries, 30),
  };
}
