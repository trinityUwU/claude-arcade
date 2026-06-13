// Tests Couche (B) : regroupement des principes par domaine, confiance, contradiction.
import { test, expect } from "bun:test";
import { buildPrinciples } from "../src/consolidate/principles.ts";
import type { SessionSummary, Principle } from "../src/consolidate/types.ts";

function principle(over: Partial<Principle> = {}): Principle {
  return {
    id: "pr1", statement: "Partir d'une maquette statique avant d'intégrer",
    domain: "design ui", trigger: "au début d'une UI",
    polarity: "positive", source: "inferred", rationale: "valider le visuel", ...over,
  };
}

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    project: "/p/a", topic: "t", wins: [], errors_claude: [], errors_chris: [],
    decisions: [], quality_score: 50, links_hint: [],
    difficulty: { level: "medium", why: "" }, problems: [], principles: [],
    sessionId: Math.random().toString(36).slice(2), file: "f", fingerprint: "1:1",
    model: "sonnet", startTs: 0, endTs: 0, notes: [], summarizedAt: 0, schemaVersion: 3, ...over,
  };
}

test("buildPrinciples : confiance croît avec la récurrence", () => {
  const one = buildPrinciples([summary({ principles: [principle()] })]);
  expect(one.domains[0]!.confidence).toBeCloseTo(0.5, 5); // 1 - 1/2

  const three = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle()] }),
    summary({ summarizedAt: 2, principles: [principle()] }),
    summary({ summarizedAt: 3, principles: [principle()] }),
  ]);
  expect(three.domains[0]!.occurrences).toBe(3);
  expect(three.domains[0]!.confidence).toBeCloseTo(0.75, 5); // 1 - 1/4
});

test("buildPrinciples : contradiction sur un même énoncé → contested + confiance ÷2", () => {
  const data = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle({ polarity: "positive" })] }),
    summary({ summarizedAt: 2, principles: [principle({ polarity: "negative" })] }),
  ]);
  const entry = data.domains[0]!;
  expect(entry.contested).toBe(true);
  expect(entry.confidence).toBeCloseTo((1 - 1 / 3) * 0.5, 3); // base 0.667 ÷2
});

test("buildPrinciples : polarité dominante = majorité", () => {
  const data = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle({ statement: "Éviter les abstractions précoces", polarity: "negative" })] }),
    summary({ summarizedAt: 2, principles: [principle({ statement: "Toujours typer explicitement", polarity: "positive" })] }),
    summary({ summarizedAt: 3, principles: [principle({ statement: "Toujours logger les erreurs", polarity: "positive" })] }),
  ]);
  // 3 instances, même domaine, énoncés différents (pas de contradiction directe) → polarité majoritaire positive
  const entry = data.domains[0]!;
  expect(entry.polarity).toBe("positive");
  expect(entry.contested).toBe(false);
});

test("buildPrinciples : représentant = instance la plus récente de la polarité dominante", () => {
  const data = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle({ statement: "vieux principe" })] }),
    summary({ summarizedAt: 5, principles: [principle({ statement: "principe récent" })] }),
  ]);
  expect(data.domains[0]!.statement).toBe("principe récent");
  expect(data.domains[0]!.instances[0]!.statement).toBe("principe récent"); // tri récent d'abord
});

test("buildPrinciples : statedCount compte les énoncés explicites de Chris", () => {
  const data = buildPrinciples([
    summary({ principles: [principle({ source: "stated" }), principle({ id: "pr2", source: "inferred" })] }),
  ]);
  expect(data.domains[0]!.statedCount).toBe(1);
  expect(data.domains[0]!.occurrences).toBe(2);
});

test("buildPrinciples : résumés v1/v2 sans principles → ignorés", () => {
  const data = buildPrinciples([summary({ principles: [] }), summary({})]);
  expect(data.domains).toEqual([]);
});

test("buildPrinciples : domaine vide (que des stopwords) → écarté", () => {
  const data = buildPrinciples([summary({ principles: [principle({ domain: "le la" })] })]);
  expect(data.domains).toEqual([]);
});
