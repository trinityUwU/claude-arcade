// Boucle d'amélioration : correction opus streamée (correctFile) puis application
// réversible (applyUpgrade) — snapshot + write + commit git + historique + reset analyse.
import { join } from "node:path";
import { scanConfig } from "../config/scan.ts";
import { configRoot } from "../config/paths.ts";
import { snapshotConfig } from "../config/backup.ts";
import { commitPaths } from "../config/git.ts";
import { loadDeepAudits, clearDeepAudit } from "./deep-store.ts";
import { recordUpgrade } from "./upgrade-store.ts";
import { loadPromptRubric } from "./pe-rubric.ts";
import { buildCorrectPrompt, CORRECTION_START, CORRECTION_END } from "./correct-prompt.ts";
import { streamClaude, type StreamRunner } from "./stream-claude.ts";
import { logger } from "../logger.ts";
import type { Correction, DeepAudit } from "./types.ts";

/** Reconstruit une analyse markdown à partir d'un audit profond au format legacy
 *  (strengths/issues/rewriteHint sans champ markdown), pour rester corrigible. */
function legacyAnalysis(deep?: DeepAudit): string {
  if (!deep) return "";
  const parts: string[] = [];
  if (deep.strengths?.length) parts.push("## Forces\n" + deep.strengths.map((s) => `- ${s}`).join("\n"));
  if (deep.issues?.length) parts.push("## Problèmes\n" + deep.issues.map((s) => `- ${s}`).join("\n"));
  if (deep.rewriteHint) parts.push("## Piste de réécriture\n" + deep.rewriteHint);
  return parts.join("\n\n");
}

/** Extrait le contenu entre sentinelles (ignore le préambule conversationnel d'opus).
 *  Fallback : retire un éventuel enrobage ```…``` si les sentinelles sont absentes. */
export function unwrap(text: string): string {
  const start = text.indexOf(CORRECTION_START);
  const end = text.lastIndexOf(CORRECTION_END);
  if (start >= 0 && end > start) {
    return text.slice(start + CORRECTION_START.length, end).replace(/^\n/, "").replace(/\n$/, "").trim();
  }
  const t = text.trim();
  const fence = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(t);
  return (fence?.[1] ?? t).trim();
}

/**
 * Corrige un fichier via claude -p OPUS en streaming, selon son analyse profonde.
 * Retourne null si chemin refusé ou analyse absente. NE modifie PAS le fichier (apply séparé).
 */
export async function correctFile(
  relPath: string, onText: (chunk: string) => void = () => {}, signal?: AbortSignal,
  runner: StreamRunner = streamClaude,
): Promise<Correction | null> {
  try {
    const tree = await scanConfig();
    const entry = tree.entries.find((e) => e.relPath === relPath);
    if (!entry) return null;  // garde whitelist
    const deep = (await loadDeepAudits())[relPath];
    const analysis = deep?.markdown?.trim() ? deep.markdown : legacyAnalysis(deep);
    if (!analysis) return null;  // pas d'analyse du tout → rien à corriger
    const before = await Bun.file(join(configRoot(), relPath)).text();
    const rubric = await loadPromptRubric();
    const prompt = buildCorrectPrompt(relPath, entry.kind, before, analysis, rubric);
    const { text, costUsd } = await runner(prompt, onText, "opus", signal);  // OPUS, jamais sonnet ici
    return { relPath, before, after: unwrap(text), costUsd };
  } catch (err) {
    logger.error({ err, relPath }, "correctFile failed");
    return null;
  }
}

/**
 * Applique la correction : snapshot + écriture + commit git, enregistre l'upgrade dans
 * l'historique, et RESET l'analyse (clearDeepAudit) → on peut relancer la boucle.
 */
export async function applyUpgrade(
  relPath: string, after: string, costUsd = 0,
): Promise<{ ok: boolean; commitHash?: string }> {
  try {
    const tree = await scanConfig();
    const entry = tree.entries.find((e) => e.relPath === relPath);
    if (!entry || !after.trim()) return { ok: false };
    const deep = (await loadDeepAudits())[relPath];
    const before = await Bun.file(join(configRoot(), relPath)).text();

    await snapshotConfig(`before-upgrade-${relPath.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`);
    await Bun.write(join(configRoot(), relPath), after);
    const commitHash = (await commitPaths([relPath], `[ARCADE] upgrade ${relPath}`)) ?? undefined;

    await recordUpgrade(relPath, {
      at: Date.now(), verdict: deep?.verdict ?? "mediocre", analysis: deep?.markdown ?? "",
      before, after, costUsd, commitHash,
    });
    await clearDeepAudit(relPath);  // reset : la boucle peut recommencer sur la version corrigée
    return { ok: true, commitHash };
  } catch (err) {
    logger.error({ err, relPath }, "applyUpgrade failed");
    return { ok: false };
  }
}
