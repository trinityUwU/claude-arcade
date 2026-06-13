// Rendu markdown borné des principes de travail, destiné à l'injection contextuelle (PUSH).
// Les principes sont GLOBAUX (cross-projet) : ils conditionnent la manière de travailler.
import type { PrincipleEntry } from "./types.ts";

const HEADER =
  "## 🧭 Principes de travail appris — claude-arcade\n\n" +
  "Façons de travailler/coder dégagées des sessions passées avec Chris. " +
  "Applique-les par défaut ; un principe contesté signale une tension à arbitrer avec lui :";

interface RenderOpts {
  maxEntries?: number;
  maxChars?: number;
}

/** Tri d'injection : énoncés explicites de Chris d'abord, puis confiance, puis récurrence. */
function rank(entries: PrincipleEntry[], maxEntries: number): PrincipleEntry[] {
  return [...entries]
    .filter((e) => e.statement.trim().length > 0)
    .sort((a, b) =>
      (b.statedCount > 0 ? 1 : 0) - (a.statedCount > 0 ? 1 : 0) ||
      b.confidence - a.confidence ||
      b.occurrences - a.occurrences,
    )
    .slice(0, maxEntries);
}

function renderEntry(entry: PrincipleEntry): string {
  const verb = entry.polarity === "positive" ? "✓ à faire" : "✗ à éviter";
  const flag = entry.contested ? " · ⚠ contesté" : "";
  const head = `### ${entry.label} · ${verb} · confiance ${entry.confidence} · vu ${entry.occurrences}×${flag}`;
  const when = entry.instances[0]?.trigger?.trim();
  return when ? `${head}\n${entry.statement}\nQuand : ${when}` : `${head}\n${entry.statement}`;
}

export function renderPrincipleContext(entries: PrincipleEntry[], opts: RenderOpts = {}): string {
  const maxEntries = opts.maxEntries ?? 6;
  const maxChars = opts.maxChars ?? 1800;
  const kept = rank(entries, maxEntries);
  if (kept.length === 0) return "";

  let out = HEADER;
  for (const entry of kept) {
    const block = `\n\n${renderEntry(entry)}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out === HEADER ? "" : out;
}
