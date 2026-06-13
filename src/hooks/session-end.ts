// Hook SessionEnd : déclenche la consolidation temps réel de la session qui vient de se terminer.
// Le travail (lent : un appel claude -p) est détaché en arrière-plan (detached + unref) pour ne
// pas retarder la fermeture du terminal et survivre à celle-ci. Anti-récursion : on ignore nos
// propres `claude -p` (reason prompt_input_exit ou ARCADE_LOOP_ACTIVE). Fail-safe total :
// ne perturbe jamais la fin de session (sortie ignorée par Claude Code).
import { spawn } from "node:child_process";
import { join } from "node:path";
import { readHookInput, loopActive } from "./hook-io.ts";

async function run(): Promise<void> {
  if (loopActive()) return;
  const input = await readHookInput();
  const file = input?.transcript_path;
  const reason = input?.reason ?? "other";
  if (!file) return;
  if (reason === "prompt_input_exit") return; // c'est notre propre pipeline claude -p

  const worker = join(import.meta.dir, "..", "consolidate", "consolidate-session.ts");
  const child = spawn("bun", ["run", worker, file, reason, input?.cwd ?? ""], {
    detached: true, // nouvelle session : immunise contre le SIGHUP de fermeture du terminal
    stdio: "ignore",
    env: { ...process.env, ARCADE_LOOP_ACTIVE: "1" },
  });
  child.unref(); // ne retient pas le hook : on rend la main immédiatement
}

try {
  await run();
} catch {
  /* fail-safe : ne jamais perturber la fin de session */
}
