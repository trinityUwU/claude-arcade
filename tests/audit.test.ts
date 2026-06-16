// Tests diagnostic config : détection langue, heuristiques, grade, parsing deep audit.
import { test, expect } from "bun:test";
import { detectEnglish } from "../src/audit/lang.ts";
import { runHeuristics } from "../src/audit/heuristics.ts";
import { scoreFromFlags, gradeFromFlags } from "../src/audit/grade.ts";
import { deepAuditFile, parseStreamed } from "../src/audit/deep.ts";
import { buildChecks } from "../src/audit/checks.ts";
import type { ConfigEntry, ConfigKind } from "../src/config/types.ts";

function entry(over: Partial<ConfigEntry>): ConfigEntry {
  return {
    kind: "skill" as ConfigKind, relPath: "skills/x/SKILL.md", name: "x",
    description: "does a thing when asked", bytes: 1000, managed: false, patchable: true, ...over,
  };
}

test("detectEnglish : prose anglaise reconnue", () => {
  expect(detectEnglish("You should use this when the task requires that you act for the user").english).toBe(true);
});

test("detectEnglish : prose française signalée non-anglaise", () => {
  expect(detectEnglish("Vous devez utiliser cette règle pour que le modèle suive les instructions dans la session").english).toBe(false);
});

test("detectEnglish : code seul → anglais par défaut (pas de faux positif)", () => {
  expect(detectEnglish("```ts\nconst x = foo(bar);\n```").english).toBe(true);
});

test("heuristique : surchargé détecté au-delà du seuil", () => {
  const flags = runHeuristics(entry({ kind: "instruction", bytes: 12_000 }), "# Titre\nblabla");
  expect(flags.some((f) => f.code === "overloaded")).toBe(true);
});

test("heuristique : skill maigre + sans description", () => {
  const flags = runHeuristics(entry({ bytes: 100, description: undefined }), "x");
  expect(flags.some((f) => f.code === "thin")).toBe(true);
  expect(flags.some((f) => f.code === "no-description")).toBe(true);
});

test("heuristique : wall-of-text sans structure", () => {
  const body = "a ".repeat(1000);
  const flags = runHeuristics(entry({ bytes: 2000 }), body);
  expect(flags.some((f) => f.code === "wall-of-text")).toBe(true);
});

test("grade : surchargé prime sur le score", () => {
  const flags = runHeuristics(entry({ kind: "instruction", bytes: 12_000 }), "# T\nok use when this for you");
  expect(gradeFromFlags(flags, scoreFromFlags(flags))).toBe("overloaded");
});

test("grade : entrée propre → excellent", () => {
  const flags = runHeuristics(
    entry({ bytes: 2000, description: "use this when asked" }),
    "# Title\nUse this when the task needs it. You must act for the user. Trigger: on request.",
  );
  expect(gradeFromFlags(flags, scoreFromFlags(flags))).toBe("excellent");
});

test("anti-pattern : sur-prompting (caps + no exception) détecté", () => {
  const body = "# T\n" + "You MUST ALWAYS do X. NEVER do Y. ABSOLUTELY FORBIDDEN. DO NOT skip. MANDATORY. There is no exception. Under no circumstances.";
  const flags = runHeuristics(entry({ kind: "instruction", bytes: body.length }), body);
  expect(flags.some((f) => f.code === "over-prompting")).toBe(true);
});

test("anti-pattern : prompt propre (instructions + why) → pas de sur-prompting", () => {
  const body = "# Title\nUse this when the task needs it, so the model knows the scope. Write flowing prose for readability.";
  const flags = runHeuristics(entry({ kind: "instruction", bytes: body.length, description: "x" }), body);
  expect(flags.some((f) => f.code === "over-prompting")).toBe(false);
});

test("buildChecks : applicabilité par kind (setting n'a que Taille)", () => {
  const settingChecks = buildChecks("setting", []);
  expect(settingChecks.map((c) => c.code)).toEqual(["overloaded"]);
  const skillChecks = buildChecks("skill", []);
  expect(skillChecks.some((c) => c.code === "no-trigger")).toBe(true);
  expect(skillChecks.every((c) => c.ok)).toBe(true);  // sans drapeau → tout vrai
});

test("buildChecks : un drapeau → la norme correspondante passe à ok=false avec message", () => {
  const checks = buildChecks("skill", [{ code: "non-english", severity: "warn", message: "x" }]);
  const lang = checks.find((c) => c.code === "non-english");
  expect(lang?.ok).toBe(false);
  expect(lang?.message).toBe("x");
});

test("deepAuditFile : chemin hors scan refusé (null, zéro token)", async () => {
  const r = await deepAuditFile("../../etc/passwd");
  expect(r).toBeNull();
});

test("parseStreamed : extrait le verdict de la 1ʳᵉ ligne + markdown + coût", () => {
  const d = parseStreamed("skills/x/SKILL.md", "VERDICT: solid\n## Forces\n- ok\n## Problèmes\n- rien", 0.0123);
  expect(d.verdict).toBe("solid");
  expect(d.markdown.startsWith("## Forces")).toBe(true);
  expect(d.costUsd).toBe(0.0123);
});

test("parseStreamed : verdict inconnu → mediocre par défaut", () => {
  expect(parseStreamed("p", "VERDICT: bizarre\ntexte", 0).verdict).toBe("mediocre");
});
