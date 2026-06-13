// Tests Vague 5 — impact post-révision : flag régression sur la qualité avant/après application.
import { test, expect } from "bun:test";
import { assessRevisions } from "../src/config/revisions.ts";
import type { SessionSummary } from "../src/consolidate/types.ts";
import type { Proposal } from "../src/config/types.ts";

const DAY = 24 * 3600_000;
const T = 1_000 * DAY;

function s(quality: number, endTs: number): SessionSummary {
  return {
    project: "/p", topic: "t", wins: [], errors_claude: [], errors_chris: [], decisions: [],
    quality_score: quality, links_hint: [], difficulty: { level: "medium", why: "" },
    problems: [], principles: [], sessionId: Math.random().toString(36).slice(2),
    file: "f", fingerprint: "1:1", model: "sonnet", startTs: 0, endTs, notes: [], summarizedAt: endTs,
    schemaVersion: 3,
  };
}

const applied: Proposal = {
  id: "patch:x", kind: "patch", title: "Évoluer x", rationale: "r", sourceKey: "x",
  targetRel: "skills/x/SKILL.md", status: "applied", createdAt: 0, appliedAt: T, commitHash: "abc1234",
};

test("régression : qualité chute après l'application (≥3 sessions/côté)", () => {
  const summaries = [
    s(80, T - 3 * DAY), s(82, T - 2 * DAY), s(78, T - DAY),
    s(60, T + DAY), s(58, T + 2 * DAY), s(62, T + 3 * DAY),
  ];
  const r = assessRevisions([applied], summaries)[0]!;
  expect(r.before).toBe(80);
  expect(r.after).toBe(60);
  expect(r.regression).toBe(true);
});

test("pas de verdict sous le seuil d'échantillon", () => {
  const summaries = [s(80, T - DAY), s(50, T + DAY)];
  const r = assessRevisions([applied], summaries)[0]!;
  expect(r.regression).toBe(false);
});

test("pas de régression si la qualité tient", () => {
  const summaries = [
    s(80, T - 3 * DAY), s(82, T - 2 * DAY), s(78, T - DAY),
    s(81, T + DAY), s(79, T + 2 * DAY), s(83, T + 3 * DAY),
  ];
  expect(assessRevisions([applied], summaries)[0]!.regression).toBe(false);
});

test("ignore les propositions non appliquées", () => {
  const pending: Proposal = { ...applied, status: "pending", appliedAt: undefined };
  expect(assessRevisions([pending], [])).toHaveLength(0);
});
