// Tests Couche 2 : injection contextuelle (rendu champions + classification de texte).
import { test, expect } from "bun:test";
import { renderChampionContext } from "../src/consolidate/champion-context.ts";
import { classifyText } from "../src/consolidate/classifier.ts";
import type {
  ChampionEntry, SchemaInstance, ResolutionSchema, ChampionsData,
} from "../src/consolidate/types.ts";

function schema(over: Partial<ResolutionSchema> = {}): ResolutionSchema {
  return {
    steps: [], tools_used: [], turns_to_resolve: 1, backtracks: 0,
    tool_errors: 0, outcome: "resolved", ...over,
  };
}

function instance(over: Partial<SchemaInstance> = {}): SchemaInstance {
  return {
    sessionId: "s1", project: "/p/a", problemId: "p1", description: "desc",
    category: "cat", severity: "minor", resolution: schema(),
    fitness: 0.5, sessionQuality: 50, at: 0, ...over,
  };
}

function entry(over: Partial<ChampionEntry> = {}): ChampionEntry {
  return {
    category: "cat", label: "Cat", champion: instance(), contenders: [],
    occurrences: 1, resolvedRate: 1, history: [], ...over,
  };
}

test("renderChampionContext : 2 entries → labels + steps joints par flèche", () => {
  const out = renderChampionContext([
    entry({ label: "Build TSC", champion: instance({ fitness: 0.9, resolution: schema({ steps: ["lire erreur", "fix type"] }) }) }),
    entry({ label: "Layout CSS", champion: instance({ fitness: 0.7 }) }),
  ]);
  expect(out).toContain("Build TSC");
  expect(out).toContain("Layout CSS");
  expect(out).toContain("lire erreur → fix type");
});

test("renderChampionContext : maxEntries=1 ne garde que le meilleur fitness", () => {
  const out = renderChampionContext([
    entry({ label: "Faible", champion: instance({ fitness: 0.2 }) }),
    entry({ label: "Fort", champion: instance({ fitness: 0.95 }) }),
  ], { maxEntries: 1 });
  expect(out).toContain("Fort");
  expect(out).not.toContain("Faible");
});

test("renderChampionContext : toutes champions null → chaîne vide", () => {
  expect(renderChampionContext([entry({ champion: null }), entry({ champion: null })])).toBe("");
});

test("renderChampionContext : tronque à maxChars sans couper une entry", () => {
  const big = (l: string): ChampionEntry =>
    entry({ label: l, champion: instance({ description: "x".repeat(300) }) });
  const out = renderChampionContext([big("Un"), big("Deux"), big("Trois")], { maxChars: 600 });
  const headers = out.split("### ").length - 1;
  const methods = out.split("Méthode :").length - 1;
  expect(headers).toBeLessThan(3);
  expect(headers).toBeGreaterThan(0);
  expect(methods).toBe(headers); // chaque entry rendue est complète
  expect(out.length).toBeLessThanOrEqual(600);
});

function champions(categories: ChampionEntry[]): ChampionsData {
  return { generatedAt: 0, categories };
}

test("classifyText : matche la catégorie pertinente et pas une autre", () => {
  const data = champions([
    entry({ category: "environnement systemd", label: "Systemd timer", champion: instance({ fitness: 0.8, description: "le timer systemd ne déclenche pas" }) }),
    entry({ category: "layout css", label: "Layout CSS", champion: instance({ fitness: 0.9, description: "alignement flexbox cassé" }) }),
  ]);
  const res = classifyText("mon systemd timer ne se lance pas au boot", data);
  expect(res.length).toBe(1);
  expect(res[0]?.category).toBe("environnement systemd");
});

test("classifyText : texte sans rapport → []", () => {
  const data = champions([entry({ category: "environnement systemd", label: "Systemd timer" })]);
  expect(classifyText("recette de tarte aux pommes", data)).toEqual([]);
});

test("classifyText : tri par score puis fitness", () => {
  const data = champions([
    entry({ category: "build tsc", label: "Build TSC", champion: instance({ fitness: 0.3, description: "erreur compilation tsc" }) }),
    entry({ category: "build tsc compilation", label: "Build TSC compilation", champion: instance({ fitness: 0.9, description: "erreur build" }) }),
  ]);
  const res = classifyText("erreur build tsc compilation", data, 2);
  expect(res[0]?.category).toBe("build tsc compilation");
});
