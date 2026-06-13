// Phase 3 — tests de la boucle de feedback : trajectoires par classe, attribution d'injection, lift causal.
import { test, expect } from "bun:test";
import { buildLearning } from "../src/consolidate/learning.ts";
import type { SessionSummary, Problem, InjectionLog, ResolutionSchema } from "../src/consolidate/types.ts";

const H = 3_600_000; // 1h — espace les sessions au-delà de la marge d'attribution (2 min)

function rs(over: Partial<ResolutionSchema> = {}): ResolutionSchema {
  return { steps: [], tools_used: [], turns_to_resolve: 3, backtracks: 0, tool_errors: 0, outcome: "resolved", ...over };
}
function problem(classId: string, r: ResolutionSchema): Problem {
  return { id: "p1", description: "d", category: classId, severity: "minor", resolution_schema: r, canonicalClassId: classId };
}
function session(over: Partial<SessionSummary> & { problems: Problem[]; startTs: number; project: string }): SessionSummary {
  return {
    topic: "t", wins: [], errors_claude: [], errors_chris: [], decisions: [],
    quality_score: 70, links_hint: [], difficulty: { level: "medium", why: "" },
    principles: [], file: "f", fingerprint: "fp", model: "sonnet", notes: [], schemaVersion: 4,
    ...over,
    sessionId: over.sessionId ?? `s${over.startTs}`,
    endTs: over.endTs ?? over.startTs + 1000,
    summarizedAt: over.summarizedAt ?? over.startTs,
  };
}
function injection(at: number, cwd: string, categories: string[]): InjectionLog["records"][number] {
  return { at, event: "session-start", cwd, categories, charCount: 100 };
}
const noInjections: InjectionLog = { generatedAt: 0, records: [] };

test("buildLearning : classe vue 1× → exclue (pas de récurrence observable)", () => {
  const d = buildLearning([session({ project: "/p", startTs: H, problems: [problem("css", rs())] })], noInjections);
  expect(d.recurringClasses).toBe(0);
  expect(d.curves).toHaveLength(0);
});

test("buildLearning : classe qui s'améliore → trend improving, fitnessDelta > 0", () => {
  const weak = rs({ turns_to_resolve: 10, backtracks: 4 });
  const strong = rs({ turns_to_resolve: 1, backtracks: 0 });
  const d = buildLearning([
    session({ project: "/p", startTs: 1 * H, problems: [problem("css", weak)] }),
    session({ project: "/p", startTs: 5 * H, problems: [problem("css", strong)] }),
  ], noInjections);
  expect(d.recurringClasses).toBe(1);
  expect(d.improvingClasses).toBe(1);
  expect(d.curves[0]!.trend).toBe("improving");
  expect(d.curves[0]!.fitnessDelta).toBeGreaterThan(0);
  expect(d.curves[0]!.turnsDelta).toBe(-9); // 1 - 10
});

test("buildLearning : encounters triés chronologiquement même si sessions désordonnées", () => {
  const d = buildLearning([
    session({ project: "/p", startTs: 9 * H, sessionId: "late", problems: [problem("css", rs())] }),
    session({ project: "/p", startTs: 1 * H, sessionId: "early", problems: [problem("css", rs())] }),
  ], noInjections);
  expect(d.curves[0]!.encounters.map((e) => e.sessionId)).toEqual(["early", "late"]);
});

test("buildLearning : attribution d'injection par cwd + fenêtre + label", () => {
  const log: InjectionLog = { generatedAt: 0, records: [injection(5 * H, "/p", ["css"])] };
  const d = buildLearning([
    session({ project: "/p", startTs: 1 * H, problems: [problem("css", rs())] }),       // pas d'injection dans sa fenêtre
    session({ project: "/p", startTs: 5 * H, problems: [problem("css", rs())] }),       // injection à 5h, match
    session({ project: "/autre", startTs: 5 * H, problems: [problem("css", rs())] }),   // mauvais cwd
  ], log);
  const enc = d.curves[0]!.encounters;
  expect(enc.find((e) => e.project === "/p" && e.at === 5 * H)!.injected).toBe(true);
  expect(enc.find((e) => e.at === 1 * H)!.injected).toBe(false);
  expect(enc.find((e) => e.project === "/autre")!.injected).toBe(false);
  expect(d.injectedEncounters).toBe(1);
});

test("buildLearning : injectionLift = fitness moyen injecté − non injecté", () => {
  const log: InjectionLog = { generatedAt: 0, records: [injection(5 * H, "/p", ["css"])] };
  const d = buildLearning([
    session({ project: "/p", startTs: 1 * H, problems: [problem("css", rs({ turns_to_resolve: 10, backtracks: 5 }))] }),
    session({ project: "/p", startTs: 5 * H, problems: [problem("css", rs({ turns_to_resolve: 1, backtracks: 0 }))] }),
  ], log);
  expect(d.injectionLift).not.toBeNull(); // l'injectée (5h) est la forte → lift positif
  expect(d.injectionLift!).toBeGreaterThan(0);
});

test("buildLearning : lift null si aucune rencontre injectée", () => {
  const d = buildLearning([
    session({ project: "/p", startTs: 1 * H, problems: [problem("css", rs())] }),
    session({ project: "/p", startTs: 5 * H, problems: [problem("css", rs())] }),
  ], noInjections);
  expect(d.injectionLift).toBeNull();
});
