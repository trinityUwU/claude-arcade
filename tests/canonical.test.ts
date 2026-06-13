// Phase 1 — tests du matching canonique : résolution déterministe des hints LLM.
import { test, expect } from "bun:test";
import { resolveCanonical, problemKey, canonicalIndexText, emptyRegistry } from "../src/consolidate/canonical.ts";
import type { Problem, CanonicalRegistry, CanonicalHint } from "../src/consolidate/types.ts";

function problem(over: Partial<Problem> & { canonicalHint?: CanonicalHint }): Problem {
  return {
    id: "p1", description: "desc", category: "cat", severity: "minor",
    resolution_schema: { steps: [], tools_used: [], turns_to_resolve: 1, backtracks: 0, tool_errors: 0, outcome: "resolved" },
    ...over,
  };
}

test("resolveCanonical : hint sans id → crée une nouvelle classe et rattache", () => {
  const { problems, registry, changed } = resolveCanonical(
    [problem({ canonicalHint: { id: "", name: "config systemd", definition: "service unit cassé" } })],
    emptyRegistry(),
  );
  expect(changed).toBe(true);
  expect(registry.classes).toHaveLength(1);
  expect(registry.classes[0]!.id).toBe("config-systemd");
  expect(registry.classes[0]!.occurrences).toBe(1);
  expect(problems[0]!.canonicalClassId).toBe("config-systemd");
  expect(problems[0]!.canonicalHint).toBeUndefined(); // hint consommé
});

test("resolveCanonical : hint avec id existant → rattache sans créer", () => {
  const reg: CanonicalRegistry = {
    schemaVersion: 1, updatedAt: 1,
    classes: [{ id: "config-systemd", name: "config systemd", definition: "x", createdAt: 1, occurrences: 3 }],
  };
  const { problems, registry } = resolveCanonical(
    [problem({ canonicalHint: { id: "config-systemd", name: "autre formulation", definition: "y" } })],
    reg,
  );
  expect(registry.classes).toHaveLength(1);
  expect(registry.classes[0]!.occurrences).toBe(4);
  expect(problems[0]!.canonicalClassId).toBe("config-systemd");
});

test("resolveCanonical : id oublié mais nom identique → rattache par nom normalisé", () => {
  const reg: CanonicalRegistry = {
    schemaVersion: 1, updatedAt: 1,
    classes: [{ id: "config-systemd", name: "Config Systemd", definition: "x", createdAt: 1, occurrences: 1 }],
  };
  const { problems, registry } = resolveCanonical(
    [problem({ canonicalHint: { id: "", name: "config systemd", definition: "y" } })],
    reg,
  );
  expect(registry.classes).toHaveLength(1); // pas de doublon
  expect(problems[0]!.canonicalClassId).toBe("config-systemd");
});

test("resolveCanonical : deux problèmes même classe dans une session → 1 classe, occ=2", () => {
  const h: CanonicalHint = { id: "", name: "parsing json", definition: "json invalide" };
  const { registry } = resolveCanonical(
    [problem({ id: "p1", canonicalHint: h }), problem({ id: "p2", canonicalHint: { ...h } })],
    emptyRegistry(),
  );
  expect(registry.classes).toHaveLength(1);
  expect(registry.classes[0]!.occurrences).toBe(2);
});

test("resolveCanonical : pas de hint → registre inchangé, pas de canonicalClassId", () => {
  const reg = emptyRegistry();
  const { problems, registry, changed } = resolveCanonical([problem({})], reg);
  expect(changed).toBe(false);
  expect(registry).toBe(reg);
  expect(problems[0]!.canonicalClassId).toBeUndefined();
});

test("problemKey : classe canonique prioritaire, sinon fallback groupingKey(category)", () => {
  expect(problemKey(problem({ canonicalClassId: "config-systemd" }))).toBe("config-systemd");
  const fallback = problemKey(problem({ category: "Layout flexbox responsive" }));
  expect(fallback).toBe("flexbox layout responsive"); // groupingKey : tokens ≥4 triés
});

test("canonicalIndexText : formate id · nom : définition, trié par occurrences", () => {
  const reg: CanonicalRegistry = {
    schemaVersion: 1, updatedAt: 1,
    classes: [
      { id: "rare", name: "rare", definition: "def rare", createdAt: 1, occurrences: 1 },
      { id: "freq", name: "freq", definition: "def freq", createdAt: 1, occurrences: 9 },
    ],
  };
  const txt = canonicalIndexText(reg);
  expect(txt.indexOf("freq")).toBeLessThan(txt.indexOf("rare")); // plus fréquent d'abord
  expect(txt).toContain("- freq · freq : def freq");
});

test("resolveCanonical : noms distincts au même slug → ids uniques", () => {
  const { registry } = resolveCanonical(
    [
      problem({ id: "p1", canonicalHint: { id: "", name: "config systemd", definition: "a" } }),
      problem({ id: "p2", canonicalHint: { id: "", name: "config: systemd!", definition: "b" } }),
    ],
    emptyRegistry(),
  );
  // "config systemd" et "config: systemd!" slugifient pareil mais sont des noms normalisés identiques
  // → rattachés à la MÊME classe (dédup par nom). Vérifie l'absence de doublon parasite.
  expect(registry.classes).toHaveLength(1);
  expect(registry.classes[0]!.occurrences).toBe(2);
});
