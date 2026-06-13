// Hook SessionStart : injecte les schémas champions du projet + les principes de travail globaux.
import { loadChampions, loadPrinciples, appendInjection } from "../consolidate/store.ts";
import { renderChampionContext } from "../consolidate/champion-context.ts";
import { renderPrincipleContext } from "../consolidate/principle-context.ts";
import type { ChampionEntry } from "../consolidate/types.ts";
import { readHookInput, emitContext, emitEmpty, loopActive } from "./hook-io.ts";

function selectForProject(entries: ChampionEntry[], cwd: string): ChampionEntry[] {
  return entries.filter((e) => {
    const proj = e.champion?.project;
    if (!proj) return false;
    return proj === cwd || cwd.startsWith(proj) || proj.startsWith(cwd);
  });
}

/** Schémas champions pertinents au projet courant (scopé cwd). */
async function championPart(cwd: string): Promise<{ text: string; labels: string[] }> {
  const champions = await loadChampions();
  if (!champions?.categories?.length) return { text: "", labels: [] };
  const selected = selectForProject(champions.categories, cwd);
  const text = renderChampionContext(selected, { maxEntries: 5, maxChars: 2000 });
  return { text, labels: text ? selected.map((e) => e.label) : [] };
}

/** Principes de travail globaux (cross-projet) : ils conditionnent la manière de coder. */
async function principlePart(): Promise<{ text: string; labels: string[] }> {
  const data = await loadPrinciples();
  if (!data?.domains?.length) return { text: "", labels: [] };
  const text = renderPrincipleContext(data.domains, { maxEntries: 6, maxChars: 1800 });
  return { text, labels: text ? data.domains.map((d) => d.label) : [] };
}

async function run(): Promise<void> {
  if (loopActive()) return emitEmpty();
  const input = await readHookInput();
  const cwd = input?.cwd;
  if (!cwd) return emitEmpty();

  const champ = await championPart(cwd);
  const principles = await principlePart();
  const parts = [champ.text, principles.text].filter((t) => t.length > 0);
  if (parts.length === 0) return emitEmpty();

  if (champ.text) {
    await appendInjection({
      at: Date.now(), event: "session-start", cwd,
      categories: champ.labels, charCount: champ.text.length,
    });
  }
  if (principles.text) {
    await appendInjection({
      at: Date.now(), event: "session-start", cwd,
      categories: principles.labels, charCount: principles.text.length,
    });
  }
  emitContext("SessionStart", parts.join("\n\n"));
}

try {
  await run();
} catch {
  emitEmpty();
}
