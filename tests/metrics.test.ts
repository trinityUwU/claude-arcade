import { describe, expect, test } from "bun:test";
import { analyzeSession } from "../src/scanner/metrics.ts";
import { aggregate, rankSkills } from "../src/scanner/aggregate.ts";
import { evaluate } from "../src/engine/evaluate.ts";
import { ACHIEVEMENTS } from "../src/engine/catalog.ts";
import type { TranscriptLine } from "../src/types.ts";

function assistant(ts: string, model: string, blocks: unknown[]): TranscriptLine {
  return { type: "assistant", timestamp: ts, sessionId: "s1", message: { model, content: blocks } };
}
function user(ts: string, blocks: unknown[]): TranscriptLine {
  return { type: "user", timestamp: ts, sessionId: "s1", message: { role: "user", content: blocks } };
}
const toolUse = (name: string, input: Record<string, unknown> = {}) => ({ type: "tool_use", name, input });
const toolErr = (text: string) => ({ type: "tool_result", is_error: true, content: text });

describe("analyzeSession", () => {
  const lines: TranscriptLine[] = [
    assistant("2026-06-07T02:30:00Z", "claude-opus-4-8", [
      toolUse("Bash"), toolUse("Edit", { file_path: "/app/x.ts" }), toolUse("Task"),
    ]),
    user("2026-06-07T02:31:00Z", [toolErr("bash: permission denied")]),
  ];
  const { counters, meta } = analyzeSession(lines, "/fake/s1.jsonl");

  test("compte les outils par famille", () => {
    expect(counters.total_tool_calls).toBe(3);
    expect(counters.total_bash_calls).toBe(1);
    expect(counters.total_file_edits).toBe(1);
    expect(counters.total_task_calls).toBe(1);
  });
  test("détecte erreurs + secret permission denied", () => {
    expect(counters.total_errors).toBe(1);
    expect(counters.permission_denied_events).toBe(1);
  });
  test("métadonnées : nuit, modèle, distinctTools", () => {
    // 02:30 UTC peut tomber 0h–6h ou non selon le fuseau ; on vérifie juste la cohérence du flag.
    expect(typeof meta.isNight).toBe("boolean");
    expect(meta.models).toContain("claude-opus-4-8");
    expect(meta.distinctTools).toBe(3);
  });
});

describe("aggregate + evaluate", () => {
  const s = analyzeSession([
    { type: "assistant", timestamp: "2026-06-07T12:00:00Z", sessionId: "s2", message: { model: "claude-opus-4-8", content: Array.from({ length: 60 }, () => toolUse("Bash")) } },
  ], "/fake/s2.jsonl");
  const agg = aggregate([s]);

  test("lifetime somme les appels d'outils", () => {
    expect(agg.total_tool_calls).toBe(60);
    expect(agg.session_count).toBe(1);
  });
  test("Let Him Cook débloque Copper à 50 tool calls/session", () => {
    const lhc = ACHIEVEMENTS.find((a) => a.id === "let_him_cook")!;
    const r = evaluate(lhc, agg);
    expect(r.state).toBe("unlocked");
    expect(r.tierName).toBe("Copper");
  });
  test("achievement secret sans signal reste caché", () => {
    const secret = ACHIEVEMENTS.find((a) => a.id === "port_3000_taken")!;
    expect(evaluate(secret, agg).state).toBe("secret");
  });
});

describe("rankSkills", () => {
  const s1 = analyzeSession([
    assistant("2026-06-07T12:00:00Z", "claude-opus-4-8", [
      toolUse("Skill", { skill: "humanizer" }), toolUse("Skill", { skill: "humanizer" }),
      toolUse("Skill", { skill: "lint" }), toolUse("Bash"),
    ]),
  ], "/fake/a.jsonl");
  const s2 = analyzeSession([
    assistant("2026-06-08T12:00:00Z", "claude-opus-4-8", [toolUse("Skill", { skill: "lint" })]),
  ], "/fake/b.jsonl");

  test("capture le nom de skill par session", () => {
    expect(s1.skills.humanizer).toBe(2);
    expect(s1.skills.lint).toBe(1);
  });
  test("classe par invocations totales + compte les sessions distinctes", () => {
    const ranked = rankSkills([s1, s2]);
    expect(ranked.map((r) => r.name)).toEqual(["humanizer", "lint"]);
    expect(ranked.find((r) => r.name === "lint")).toEqual({ name: "lint", count: 2, sessions: 2 });
  });
});
