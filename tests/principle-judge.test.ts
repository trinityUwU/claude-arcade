// Tests Couche (B) juge : signature, éligibilité, réattachement mémoïsé, validation du verdict.
import { test, expect } from "bun:test";
import { buildPrinciples, eligibleForJudgment, distinctStatements } from "../src/consolidate/principles.ts";
import { validateJudgment } from "../src/consolidate/principle-judge.ts";
import type { SessionSummary, Principle, JudgmentsData } from "../src/consolidate/types.ts";

function principle(over: Partial<Principle> = {}): Principle {
  return {
    id: "pr1", statement: "Maquette d'abord", domain: "design ui", trigger: "au début",
    polarity: "positive", source: "inferred", rationale: "valider", ...over,
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

test("eligibleForJudgment : 1 seul énoncé distinct → non éligible", () => {
  const data = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle()] }),
    summary({ summarizedAt: 2, principles: [principle()] }),
  ]);
  expect(distinctStatements(data.domains[0]!.instances).length).toBe(1);
  expect(eligibleForJudgment(data.domains[0]!)).toBe(false);
});

test("eligibleForJudgment : 2+ énoncés distincts → éligible", () => {
  const data = buildPrinciples([
    summary({ summarizedAt: 1, principles: [principle({ statement: "Wrapper systemd" })] }),
    summary({ summarizedAt: 2, principles: [principle({ statement: "Chemin absolu dans le service" })] }),
  ]);
  expect(eligibleForJudgment(data.domains[0]!)).toBe(true);
});

test("buildPrinciples : jugement réattaché seulement si la signature matche", () => {
  const base = [
    summary({ summarizedAt: 1, principles: [principle({ statement: "Wrapper systemd" })] }),
    summary({ summarizedAt: 2, principles: [principle({ statement: "Chemin absolu" })] }),
  ];
  const sig = buildPrinciples(base).domains[0]!.signature;
  const judgments: JudgmentsData = {
    generatedAt: 0,
    byDomain: { [buildPrinciples(base).domains[0]!.domain]: {
      synthesis: "s", ranked: [{ statement: "Wrapper systemd", power: 0.8, pros: [], cons: [] }],
      recommendation: "r", signature: sig, model: "sonnet", judgedAt: 1,
    } },
  };
  // signature inchangée → attaché
  expect(buildPrinciples(base, judgments).domains[0]!.judgment).toBeDefined();
  // matière modifiée → signature change → jugement périmé, détaché
  const changed = [...base, summary({ summarizedAt: 3, principles: [principle({ statement: "Nouvelle approche" })] })];
  expect(buildPrinciples(changed, judgments).domains[0]!.judgment).toBeUndefined();
});

test("validateJudgment : classe par puissance décroissante, défauts sûrs", () => {
  const j = validateJudgment({
    synthesis: "compare",
    ranked: [
      { statement: "faible", power: 0.2, pros: ["p"], cons: [] },
      { statement: "forte", power: 0.9, pros: [], cons: ["c", 42] },
    ],
    recommendation: "fais forte",
  }, "sig1", "sonnet");
  expect(j).not.toBeNull();
  expect(j?.ranked[0]?.statement).toBe("forte");
  expect(j?.ranked[0]?.cons).toEqual(["c"]); // non-strings filtrés
  expect(j?.ranked[1]?.statement).toBe("faible");
  expect(j?.signature).toBe("sig1");
});

test("validateJudgment : power hors borne clampé, statement vide rejeté", () => {
  const j = validateJudgment({
    ranked: [{ statement: "x", power: 5 }, { statement: "  ", power: 0.5 }],
  }, "s", "sonnet");
  expect(j?.ranked.length).toBe(1);
  expect(j?.ranked[0]?.power).toBe(1);
});

test("validateJudgment : ranked vide → null", () => {
  expect(validateJudgment({ synthesis: "x", ranked: [] }, "s", "m")).toBeNull();
  expect(validateJudgment(null, "s", "m")).toBeNull();
});
