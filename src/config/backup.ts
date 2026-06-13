// Backup complète de la config Claude Code (tar.gz horodaté) — filet en plus des checkpoints git.
// Appelé avant chaque write-back auto (incrément 3) + à la demande. Rétention bornée.
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { configRoot } from "./paths.ts";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";

// Surface complète de la config (inclut .mcp.json : backup locale de restauration, jamais poussée).
const CONFIG_PATHS = ["CLAUDE.md", "rules", "commands", "skills", "settings.json", ".mcp.json"];
const RETENTION = 30;

export function backupsDir(): string {
  return join(stateDir(), "config-backups");
}

async function pruneBackups(dir: string): Promise<void> {
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".tar.gz"));
    if (files.length <= RETENTION) return;
    const withTime = await Promise.all(
      files.map(async (f) => ({ f, t: (await stat(join(dir, f))).mtimeMs })),
    );
    withTime.sort((a, b) => b.t - a.t);
    for (const { f } of withTime.slice(RETENTION)) await unlink(join(dir, f));
  } catch (err) {
    logger.warn({ err }, "pruneBackups failed");
  }
}

/** Snapshot tar.gz complet de la config. Retourne le chemin de l'archive, ou null si échec. */
export async function snapshotConfig(label = "auto"): Promise<string | null> {
  const dir = backupsDir();
  try {
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safe = label.replace(/[^a-z0-9_-]/gi, "-").slice(0, 40) || "auto";
    const out = join(dir, `config-${stamp}-${safe}.tar.gz`);
    const args = ["-czf", out, "-C", configRoot(), "--ignore-failed-read", ...CONFIG_PATHS];
    const proc = Bun.spawn(["tar", ...args], { stdout: "ignore", stderr: "pipe" });
    if ((await proc.exited) !== 0) {
      logger.warn({ err: (await new Response(proc.stderr).text()).trim(), out }, "snapshotConfig tar non-zero");
    }
    if (!(await Bun.file(out).exists())) return null;
    await pruneBackups(dir);
    return out;
  } catch (err) {
    logger.error({ err }, "snapshotConfig failed");
    return null;
  }
}

export interface BackupInfo { file: string; bytes: number; at: number }

/** Liste les snapshots existants, du plus récent au plus ancien. */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    const dir = backupsDir();
    const files = (await readdir(dir)).filter((f) => f.endsWith(".tar.gz"));
    const infos = await Promise.all(files.map(async (f) => {
      const st = await stat(join(dir, f));
      return { file: f, bytes: st.size, at: st.mtimeMs };
    }));
    return infos.sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}
