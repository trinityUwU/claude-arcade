// Tests Vague 5 inc.2 — couverture skills : gaps (gate occ/projets/match) + morts.
import { test, expect } from "bun:test";
import { buildCoverage } from "../src/config/coverage.ts";
import type { SessionSummary, Problem, CanonicalRegistry, ChampionsData } from "../src/consolidate/types.ts";
import type { SkillUsage } from "../src/types.ts";
import type { ConfigEntry } from "../src/config/types.ts";

function problem(classId: string): Problem {
  return {
    id: Math.random().toString(36).slice(2), description: "p", category: "c", severity: "minor",
    resolution_schema: { steps: [], tools_used: [], turns_to_resolve: 1, backtracks: 0, tool_errors: 0, outcome: "resolved" },
    canonicalClassId: classId,
  };
}

function summary(project: string, classId: string): SessionSummary {
  return {
    project, topic: "t", wins: [], errors_claude: [], errors_chris: [], decisions: [],
    quality_score: 50, links_hint: [], difficulty: { level: "medium", why: "" },
    problems: [problem(classId)], principles: [],
    sessionId: Math.random().toString(36).slice(2), file: "f", fingerprint: "1:1",
    model: "sonnet", startTs: 0, endTs: 0, notes: [], summarizedAt: 0, schemaVersion: 3,
  };
}

function registry(occ: number): CanonicalRegistry {
  return {
    schemaVersion: 1, updatedAt: 0,
    classes: [{ id: "pagination-api", name: "pagination API mismatch", definition: "désaccord de pagination entre frontend et backend", createdAt: 0, occurrences: occ }],
  };
}

const noChampions: ChampionsData = { generatedAt: 0, categories: [] };
const skillEntry = (name: string, desc: string): ConfigEntry =>
  ({ kind: "skill", relPath: `skills/${name}/SKILL.md`, name, description: desc, bytes: 1, managed: false, patchable: true });

test("gap : classe récurrente cross-projet sans skill couvrant", () => {
  const summaries = [summary("/p/a", "pagination-api"), summary("/p/b", "pagination-api"),
    summary("/p/a", "pagination-api"), summary("/p/b", "pagination-api")];
  const r = buildCoverage(summaries, registry(4), noChampions, [], [skillEntry("humanizer", "enlève les marqueurs IA")]);
  expect(r.gaps).toHaveLength(1);
  expect(r.gaps[0]!.className).toBe("pagination API mismatch");
  expect(r.gaps[0]!.projects.sort()).toEqual(["/p/a", "/p/b"]);
});

test("pas de gap : un skill couvre la classe (tokens partagés)", () => {
  const summaries = [summary("/p/a", "pagination-api"), summary("/p/b", "pagination-api")];
  const skill = skillEntry("pagination-fixer", "résout les mismatch de pagination entre frontend et backend");
  expect(buildCoverage(summaries, registry(4), noChampions, [], [skill]).gaps).toHaveLength(0);
});

test("pas de gap : sous le seuil (1 seul projet)", () => {
  const summaries = [summary("/p/a", "pagination-api"), summary("/p/a", "pagination-api")];
  expect(buildCoverage(summaries, registry(4), noChampions, [], []).gaps).toHaveLength(0);
});

test("morts : skill patchable jamais invoqué", () => {
  const entries = [skillEntry("vieux-skill", "jamais utilisé"), skillEntry("actif", "utilisé")];
  const usage: SkillUsage[] = [{ name: "actif", count: 12, sessions: 5 }];
  const r = buildCoverage([], registry(4), noChampions, usage, entries);
  expect(r.dead.map((d) => d.name)).toEqual(["vieux-skill"]);
});
