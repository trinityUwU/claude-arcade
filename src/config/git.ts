// Wrapper git scopé à ~/.claude : historique, diff, commit atomique, revert.
// Tout est en lecture seule ici sauf commit/revert (utilisés par le write-back, incrément 3).
import { configRoot } from "./paths.ts";
import { logger } from "../logger.ts";
import type { ConfigCommit } from "./types.ts";

const SEP = "\x1f";

async function runGit(args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd: configRoot(), stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      logger.warn({ args, err: err.trim() }, "git non-zero");
      return { ok: false, out: "" };
    }
    return { ok: true, out };
  } catch (err) {
    logger.error({ err, args }, "git spawn failed");
    return { ok: false, out: "" };
  }
}

export async function isRepo(): Promise<boolean> {
  const { ok, out } = await runGit(["rev-parse", "--is-inside-work-tree"]);
  return ok && out.trim() === "true";
}

/** Historique d'un fichier (commits qui l'ont touché), du plus récent au plus ancien. */
export async function fileHistory(rel: string, limit = 30): Promise<ConfigCommit[]> {
  const { ok, out } = await runGit(["log", `-n${limit}`, `--format=%H${SEP}%aI${SEP}%s`, "--", rel]);
  if (!ok) return [];
  return out.split("\n").filter(Boolean).map((line) => {
    const [hash, date, subject] = line.split(SEP);
    return { hash: hash ?? "", date: date ?? "", subject: subject ?? "" } satisfies ConfigCommit;
  });
}

/** Diff d'un commit restreint à un fichier (pour la vue détail d'un patch). */
export async function fileDiff(hash: string, rel: string): Promise<string> {
  const { ok, out } = await runGit(["show", "--format=%b", hash, "--", rel]);
  return ok ? out : "";
}

/** Stage les chemins donnés et committe. Retourne le hash court, ou null si rien à committer. */
export async function commitPaths(rels: string[], message: string): Promise<string | null> {
  if (!rels.length) return null;
  const added = await runGit(["add", "--", ...rels]);
  if (!added.ok) return null;
  const committed = await runGit(["commit", "-m", message]);
  if (!committed.ok) return null;
  const head = await runGit(["rev-parse", "--short", "HEAD"]);
  return head.ok ? head.out.trim() : null;
}

/** Revert d'un commit (write-back qui a dégradé). --no-edit pour rester non-interactif. */
export async function revertCommit(hash: string): Promise<boolean> {
  const { ok } = await runGit(["revert", "--no-edit", hash]);
  return ok;
}
