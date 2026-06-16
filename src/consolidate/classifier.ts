// Classification déterministe d'un texte libre vers les ChampionEntry pertinents (recouvrement de tokens).
import type { ChampionEntry, ChampionsData } from "./types.ts";
import { normalizeText } from "./text-normalize.ts";

const LABEL_WEIGHT = 2;
const DESC_WEIGHT = 1;

// Mots omniprésents dans les prompts de Chris ET dans les descriptions des champions.
// Ils créent des overlaps parasites (un champion "matche" via un mot générique sans
// rapport réel) → on les neutralise au tokenize. Liste volontairement courte : on cible
// le bruit conversationnel récurrent, pas un nettoyage linguistique exhaustif.
const STOPWORDS = new Set([
  "config", "configuration", "projet", "projets", "session", "sessions",
  "fichier", "fichiers", "code", "prompt", "claude", "agent", "agents",
  "chris", "faire", "chose", "choses", "truc", "trucs", "process",
  "tache", "taches", "travail", "outil", "outils", "systeme", "contexte",
]);

// Score minimum pour qu'un champion soit jugé pertinent. Sous ce seuil = bruit (un seul
// token incident), on n'injecte rien. 3 = au moins deux hits indépendants (1 label + 1 desc,
// 2 tokens label, ou 3 tokens desc). Override via ARCADE_CLASSIFIER_MIN_SCORE.
const DEFAULT_MIN_SCORE = 3;

function minScore(): number {
  const raw = process.env.ARCADE_CLASSIFIER_MIN_SCORE;
  if (!raw) return DEFAULT_MIN_SCORE;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_SCORE;
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

function overlap(textTokens: Set<string>, source: string): number {
  let hits = 0;
  for (const token of tokenize(source)) {
    if (textTokens.has(token)) hits += 1;
  }
  return hits;
}

function scoreEntry(textTokens: Set<string>, entry: ChampionEntry): { score: number; labelScore: number } {
  const labelScore = overlap(textTokens, `${entry.category} ${entry.label}`);
  const descScore = overlap(textTokens, entry.champion?.description ?? "");
  return { score: labelScore * LABEL_WEIGHT + descScore * DESC_WEIGHT, labelScore };
}

export function classifyText(
  text: string,
  champions: ChampionsData,
  limit = 3,
): ChampionEntry[] {
  const textTokens = tokenize(text);
  if (textTokens.size === 0) return [];

  const threshold = minScore();
  return champions.categories
    .filter((e) => e.champion !== null)
    .map((e) => ({ entry: e, ...scoreEntry(textTokens, e) }))
    // Signal fort obligatoire : un champion qui ne touche que la description (mots
    // génériques) sans aucun hit sur son label est du bruit → on l'écarte.
    .filter((s) => s.score >= threshold && s.labelScore >= 1)
    .sort((a, b) => b.score - a.score || (b.entry.champion?.fitness ?? 0) - (a.entry.champion?.fitness ?? 0))
    .slice(0, limit)
    .map((s) => s.entry);
}
