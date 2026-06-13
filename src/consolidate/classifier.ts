// Classification déterministe d'un texte libre vers les ChampionEntry pertinents (recouvrement de tokens).
import type { ChampionEntry, ChampionsData } from "./types.ts";
import { normalizeText } from "./text-normalize.ts";

const LABEL_WEIGHT = 2;
const DESC_WEIGHT = 1;

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((w) => w.length >= 4),
  );
}

function overlap(textTokens: Set<string>, source: string): number {
  let hits = 0;
  for (const token of tokenize(source)) {
    if (textTokens.has(token)) hits += 1;
  }
  return hits;
}

function scoreEntry(textTokens: Set<string>, entry: ChampionEntry): number {
  const labelScore = overlap(textTokens, `${entry.category} ${entry.label}`);
  const descScore = overlap(textTokens, entry.champion?.description ?? "");
  return labelScore * LABEL_WEIGHT + descScore * DESC_WEIGHT;
}

export function classifyText(
  text: string,
  champions: ChampionsData,
  limit = 3,
): ChampionEntry[] {
  const textTokens = tokenize(text);
  if (textTokens.size === 0) return [];

  return champions.categories
    .filter((e) => e.champion !== null)
    .map((e) => ({ entry: e, score: scoreEntry(textTokens, e) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.entry.champion?.fitness ?? 0) - (a.entry.champion?.fitness ?? 0))
    .slice(0, limit)
    .map((s) => s.entry);
}
