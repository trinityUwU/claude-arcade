// Couche 2 — graphe écosystème (LISTE 1, type Obsidian 2D).
// Transforme résumés + insights en {nodes, edges} : sessions, projets, notions,
// erreurs récurrentes, process gagnants — un réseau interconnecté.
import type {
  SessionSummary, Insights, GraphData, GraphNode, GraphEdge, GraphHealth, RecurringItem,
} from "./types.ts";
import { notionKey } from "./text-normalize.ts";

function projectHealth(avg: number): GraphHealth {
  if (avg >= 75) return "strong";
  if (avg < 50) return "weak";
  return "watch";
}
function sessionHealth(score: number): GraphHealth {
  if (score >= 75) return "strong";
  if (score < 40) return "weak";
  return "watch";
}

function projectNodes(ins: Insights): GraphNode[] {
  return ins.projects.map((p) => ({
    id: `proj:${p.project}`, label: p.project.split("/").pop() || p.project,
    type: "project", weight: 6 + p.sessions, health: projectHealth(p.avgQuality),
    meta: { sessions: p.sessions, avgQuality: p.avgQuality, full: p.project },
  }));
}

function sessionNodes(summaries: SessionSummary[]): GraphNode[] {
  return summaries.map((s) => ({
    id: `sess:${s.sessionId}`, label: s.topic, type: "session",
    weight: 3, health: sessionHealth(s.quality_score),
    meta: { quality: s.quality_score, project: s.project, file: s.file },
  }));
}

function notionNodes(ins: Insights): GraphNode[] {
  return ins.topNotions.filter((n) => n.count >= 2).map((n) => ({
    id: `notion:${n.text}`, label: n.text, type: "notion",
    weight: 2 + n.count, health: "neutral",
  }));
}

function recurringNodes(items: RecurringItem[], prefix: string, type: GraphNode["type"], health: GraphHealth): GraphNode[] {
  return items.map((it, i) => ({
    id: `${prefix}:${i}`, label: it.text, type,
    weight: 2 + it.count, health, meta: { count: it.count, projects: it.projects },
  }));
}

function sessionEdges(summaries: SessionSummary[], notionSet: Set<string>): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const s of summaries) {
    const sid = `sess:${s.sessionId}`;
    if (s.project) edges.push({ source: sid, target: `proj:${s.project}`, kind: "belongs", weight: 2 });
    for (const hint of new Set(s.links_hint.map(notionKey))) {
      if (notionSet.has(hint)) edges.push({ source: sid, target: `notion:${hint}`, kind: "mentions", weight: 1 });
    }
  }
  return edges;
}

function recurringEdges(items: RecurringItem[], prefix: string, kind: string): GraphEdge[] {
  const edges: GraphEdge[] = [];
  items.forEach((it, i) => {
    for (const session of it.sessions) {
      edges.push({ source: `sess:${session}`, target: `${prefix}:${i}`, kind, weight: 1 });
    }
  });
  return edges;
}

export function buildGraph(summaries: SessionSummary[], ins: Insights): GraphData {
  const notionSet = new Set(ins.topNotions.filter((n) => n.count >= 2).map((n) => n.text));
  const nodes: GraphNode[] = [
    ...projectNodes(ins), ...sessionNodes(summaries), ...notionNodes(ins),
    ...recurringNodes(ins.recurringErrorsClaude, "errc", "error", "weak"),
    ...recurringNodes(ins.recurringErrorsChris, "errch", "error", "weak"),
    ...recurringNodes(ins.winningProcesses, "proc", "process", "strong"),
  ];
  const edges: GraphEdge[] = [
    ...sessionEdges(summaries, notionSet),
    ...recurringEdges(ins.recurringErrorsClaude, "errc", "error-claude"),
    ...recurringEdges(ins.recurringErrorsChris, "errch", "error-chris"),
    ...recurringEdges(ins.winningProcesses, "proc", "winning-process"),
  ];
  return { generatedAt: Date.now(), nodes, edges };
}
