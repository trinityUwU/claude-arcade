// Rendu markdown borné des champions, destiné à l'injection contextuelle (PUSH).
import type { ChampionEntry } from "./types.ts";

const HEADER =
  "## 🏆 Schémas de résolution éprouvés — claude-arcade\n\n" +
  "Pour ces types de problèmes déjà rencontrés, voici la meilleure approche connue " +
  "(apprise de sessions passées) :";

interface RenderOpts {
  maxEntries?: number;
  maxChars?: number;
}

function clampEntries(entries: ChampionEntry[], maxEntries: number): ChampionEntry[] {
  return entries
    .filter((e) => e.champion !== null)
    .sort((a, b) => (b.champion?.fitness ?? 0) - (a.champion?.fitness ?? 0))
    .slice(0, maxEntries);
}

function renderEntry(entry: ChampionEntry): string {
  const champ = entry.champion;
  if (champ === null) return "";
  const steps = champ.resolution.steps.join(" → ");
  const tools = champ.resolution.tools_used.join(", ");
  return (
    `### ${entry.label}  ·  fitness ${champ.fitness} · vu ${entry.occurrences}×\n` +
    `Problème type : ${champ.description}\n` +
    `Méthode : ${steps}\n` +
    `Outils : ${tools}`
  );
}

export function renderChampionContext(entries: ChampionEntry[], opts: RenderOpts = {}): string {
  const maxEntries = opts.maxEntries ?? 5;
  const maxChars = opts.maxChars ?? 2000;
  const kept = clampEntries(entries, maxEntries);
  if (kept.length === 0) return "";

  let out = HEADER;
  for (const entry of kept) {
    const block = `\n\n${renderEntry(entry)}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out === HEADER ? "" : out;
}
