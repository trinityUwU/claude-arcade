// Tests Vague 5 inc.3b — graduation (détection propositions) + fusion journal.
import { test, expect } from "bun:test";
import { buildGraduation, mergeWithJournal } from "../src/config/graduation.ts";
import type { PrinciplesData, PrincipleEntry, PrincipleJudgment } from "../src/consolidate/types.ts";
import type { ConfigEntry, CoverageReport, Proposal } from "../src/config/types.ts";

const judgment: PrincipleJudgment = {
  synthesis: "s", ranked: [{ statement: "x", power: 0.9, pros: [], cons: [] }],
  recommendation: "fais X", signature: "sig", model: "sonnet", judgedAt: 1,
};

function domain(over: Partial<PrincipleEntry> = {}): PrincipleEntry {
  return {
    domain: "debug methodique", label: "debug methodique",
    statement: "remonter DB puis API puis frontend avant de toucher au code",
    polarity: "positive", occurrences: 3, confidence: 0.8, contested: false,
    statedCount: 1, signature: "sig", judgment, instances: [], ...over,
  };
}

const skill = (name: string, desc: string): ConfigEntry =>
  ({ kind: "skill", relPath: `skills/${name}/SKILL.md`, name, description: desc, bytes: 1, managed: false, patchable: true });

const emptyCoverage: CoverageReport = { generatedAt: 0, gaps: [], dead: [] };
const noPrinciples: PrinciplesData = { generatedAt: 0, domains: [] };

test("patch : principe confiant + jugé + skill correspondant → proposition patch", () => {
  const principles: PrinciplesData = { generatedAt: 0, domains: [domain()] };
  const skills = [skill("systematic-debugging", "remonter DB API frontend, root cause, debug methodique")];
  const out = buildGraduation(principles, emptyCoverage, skills);
  expect(out).toHaveLength(1);
  expect(out[0]!.kind).toBe("patch");
  expect(out[0]!.targetRel).toBe("skills/systematic-debugging/SKILL.md");
});

test("patch : principe contesté ou peu confiant → pas de proposition", () => {
  const skills = [skill("systematic-debugging", "debug methodique remonter DB API frontend")];
  expect(buildGraduation({ generatedAt: 0, domains: [domain({ contested: true })] }, emptyCoverage, skills)).toHaveLength(0);
  expect(buildGraduation({ generatedAt: 0, domains: [domain({ confidence: 0.5 })] }, emptyCoverage, skills)).toHaveLength(0);
  expect(buildGraduation({ generatedAt: 0, domains: [domain({ judgment: undefined })] }, emptyCoverage, skills)).toHaveLength(0);
});

test("create + archive : gaps créables et morts archivables → propositions", () => {
  const coverage: CoverageReport = {
    generatedAt: 0,
    gaps: [{ classId: "c1", className: "pagination", definition: "def", occurrences: 5, projects: ["/a", "/b"], championFitness: null, creatable: true, block: null },
      { classId: "c2", className: "perm", definition: "env", occurrences: 5, projects: ["/a", "/b"], championFitness: null, creatable: false, block: "env-failure" }],
    dead: [{ name: "vieux", relPath: "skills/vieux/SKILL.md", invocations: 0, sessions: 0, silentLoad: false, archivable: true },
      { name: "llm-rag", relPath: "skills/llm-rag/SKILL.md", invocations: 0, sessions: 0, silentLoad: true, archivable: false }],
  };
  const out = buildGraduation(noPrinciples, coverage, []);
  expect(out.map((p) => p.kind).sort()).toEqual(["archive", "create"]);
  expect(out.find((p) => p.kind === "create")!.sourceKey).toBe("c1");
  expect(out.find((p) => p.kind === "archive")!.sourceKey).toBe("vieux");
});

test("mergeWithJournal : un id déjà appliqué garde son statut", () => {
  const live: Proposal[] = [{ id: "create:c1", kind: "create", title: "t", rationale: "r", sourceKey: "c1", status: "pending", createdAt: 0 }];
  const journal: Proposal[] = [{ id: "create:c1", kind: "create", title: "t", rationale: "r", sourceKey: "c1", status: "applied", createdAt: 0, appliedAt: 1, commitHash: "abc" }];
  const merged = mergeWithJournal(live, journal);
  expect(merged).toHaveLength(1);
  expect(merged[0]!.status).toBe("applied");
  expect(merged[0]!.commitHash).toBe("abc");
});
