// Hook UserPromptSubmit : injecte les schémas champions pertinents pour le prompt soumis.
import { loadChampions, appendInjection } from "../consolidate/store.ts";
import { renderChampionContext } from "../consolidate/champion-context.ts";
import { classifyText } from "../consolidate/classifier.ts";
import { readHookInput, emitContext, emitEmpty, loopActive } from "./hook-io.ts";

async function run(): Promise<void> {
  if (loopActive()) return emitEmpty();
  const input = await readHookInput();
  const cwd = input?.cwd;
  const prompt = input?.prompt;
  if (!cwd || !prompt) return emitEmpty();

  const champions = await loadChampions();
  if (!champions?.categories?.length) return emitEmpty();

  const entries = classifyText(prompt, champions, 3);
  const text = renderChampionContext(entries, { maxEntries: 3, maxChars: 1500 });
  if (!text) return emitEmpty();

  await appendInjection({
    at: Date.now(),
    event: "user-prompt-submit",
    cwd,
    categories: entries.map((e) => e.label),
    charCount: text.length,
  });
  emitContext("UserPromptSubmit", text);
}

try {
  await run();
} catch {
  emitEmpty();
}
