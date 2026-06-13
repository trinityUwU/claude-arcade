// Hook SessionStart : injecte les schémas champions pertinents pour le projet de la session.
import { loadChampions, appendInjection } from "../consolidate/store.ts";
import { renderChampionContext } from "../consolidate/champion-context.ts";
import type { ChampionEntry } from "../consolidate/types.ts";
import { readHookInput, emitContext, emitEmpty, loopActive } from "./hook-io.ts";

function selectForProject(entries: ChampionEntry[], cwd: string): ChampionEntry[] {
  return entries.filter((e) => {
    const proj = e.champion?.project;
    if (!proj) return false;
    return proj === cwd || cwd.startsWith(proj) || proj.startsWith(cwd);
  });
}

async function run(): Promise<void> {
  if (loopActive()) return emitEmpty();
  const input = await readHookInput();
  const cwd = input?.cwd;
  if (!cwd) return emitEmpty();

  const champions = await loadChampions();
  if (!champions?.categories?.length) return emitEmpty();

  const selected = selectForProject(champions.categories, cwd);
  const text = renderChampionContext(selected, { maxEntries: 5, maxChars: 2000 });
  if (!text) return emitEmpty();

  await appendInjection({
    at: Date.now(),
    event: "session-start",
    cwd,
    categories: selected.map((e) => e.label),
    charCount: text.length,
  });
  emitContext("SessionStart", text);
}

try {
  await run();
} catch {
  emitEmpty();
}
