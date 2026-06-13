// Application d'une proposition : snapshot (double filet) → génération/déplacement → write → commit
// → journal. Patch/create passent par le LLM (injectable) ; archive est token-free (déplacement).
import { mkdir, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { configRoot } from "./paths.ts";
import { snapshotConfig } from "./backup.ts";
import { commitPaths } from "./git.ts";
import { generatePatch, generateCreate, type Generator } from "./evolve.ts";
import { recordProposal } from "./proposals-store.ts";
import { logger } from "../logger.ts";
import type { Proposal } from "./types.ts";

const ARCHIVE_DIR = "skills/.archived";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "skill";
}

function skillName(rel: string): string {
  const parts = rel.split("/");
  return parts.at(-1) === "SKILL.md" ? (parts.at(-2) ?? rel) : (parts.at(-1) ?? rel).replace(/\.md$/, "");
}

/** Déplace un skill vers skills/.archived/ (réversible). Retourne [ancien, nouveau] pour le commit. */
async function archive(root: string, targetRel: string): Promise<[string, string]> {
  const isDir = targetRel.endsWith("/SKILL.md");
  const src = isDir ? dirname(targetRel) : targetRel;
  const dst = `${ARCHIVE_DIR}/${src.replace(/^skills\//, "")}`;
  await mkdir(join(root, dirname(dst)), { recursive: true });
  await rename(join(root, src), join(root, dst));
  return [src, dst];
}

async function reject(p: Proposal, note: string, backupPath: string | null): Promise<Proposal> {
  const out: Proposal = { ...p, status: "rejected", note, backupPath: backupPath ?? undefined };
  await recordProposal(out);
  return out;
}

/** Applique une proposition. `gen` injectable (tests sans tokens). Toujours snapshot avant écriture. */
export async function applyProposal(p: Proposal, gen?: Generator): Promise<Proposal> {
  const root = configRoot();
  const backupPath = await snapshotConfig(`before-${p.kind}-${slug(p.sourceKey)}`);
  try {
    const changed: string[] = [];
    let finalRel = p.targetRel;

    if (p.kind === "archive") {
      if (!p.targetRel) throw new Error("targetRel manquant pour archive");
      const [src, dst] = await archive(root, p.targetRel);
      changed.push(src, dst); finalRel = dst;
    } else if (p.kind === "patch") {
      if (!p.targetRel) throw new Error("targetRel manquant pour patch");
      const current = await Bun.file(join(root, p.targetRel)).text();
      const res = await generatePatch(skillName(p.targetRel), current, p.rationale, gen);
      if ("skip" in res) return reject(p, res.skip, backupPath);
      await Bun.write(join(root, p.targetRel), res.content);
      changed.push(p.targetRel);
    } else {
      const res = await generateCreate(p.title.replace(/^Créer un skill : /, ""), p.rationale, [], gen);
      if ("skip" in res) return reject(p, res.skip, backupPath);
      finalRel = `skills/${slug(p.sourceKey)}/SKILL.md`;
      await mkdir(dirname(join(root, finalRel)), { recursive: true });
      await Bun.write(join(root, finalRel), res.content);
      changed.push(finalRel);
    }

    const hash = await commitPaths(changed, `[arcade] ${p.title}`);
    const applied: Proposal = {
      ...p, status: "applied", appliedAt: Date.now(),
      commitHash: hash ?? undefined, backupPath: backupPath ?? undefined, targetRel: finalRel,
    };
    await recordProposal(applied);
    return applied;
  } catch (err) {
    logger.error({ err, id: p.id }, "applyProposal failed");
    const failed: Proposal = { ...p, status: "failed", note: String(err), backupPath: backupPath ?? undefined };
    await recordProposal(failed);
    return failed;
  }
}
