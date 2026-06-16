// Verdict approfondi d'un fichier via claude -p (action explicite → seule dépense de tokens).
// Générateur injectable pour tester sans cramer de tokens.
import { join } from "node:path";
import { runIsolatedClaude, defaultModel } from "../consolidate/summarize.ts";
import { envelopeResult, extractJson } from "../consolidate/parse.ts";
import { scanConfig } from "../config/scan.ts";
import { configRoot } from "../config/paths.ts";
import { buildDeepAuditPrompt } from "./audit-prompt.ts";
import { loadPromptRubric } from "./pe-rubric.ts";
import { saveDeepAudit } from "./deep-store.ts";
import { logger } from "../logger.ts";
import type { DeepAudit, AuditGrade } from "./types.ts";

const TIMEOUT_MS = 120_000;
const GRADES: readonly AuditGrade[] = ["excellent", "solid", "mediocre", "overloaded", "thin"];
export type Generator = (prompt: string) => Promise<string>;
const defaultGen: Generator = (p) => runIsolatedClaude(p, defaultModel(), TIMEOUT_MS);

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

function parseDeep(relPath: string, raw: string): DeepAudit | null {
  const obj = extractJson(envelopeResult(raw)) as Record<string, unknown> | null;
  if (!obj) return null;
  const verdict = typeof obj.verdict === "string" && (GRADES as readonly string[]).includes(obj.verdict)
    ? (obj.verdict as AuditGrade) : "mediocre";
  return {
    relPath, verdict,
    strengths: strArr(obj.strengths), issues: strArr(obj.issues),
    rewriteHint: typeof obj.rewriteHint === "string" ? obj.rewriteHint.trim() : "",
  };
}

/** Audit profond d'un fichier whitelisté. Retourne null si chemin refusé ou génération illisible. */
export async function deepAuditFile(relPath: string, gen: Generator = defaultGen): Promise<DeepAudit | null> {
  try {
    const tree = await scanConfig();
    const entry = tree.entries.find((e) => e.relPath === relPath);
    if (!entry) return null;  // garde whitelist : refuse tout hors scan
    const content = await Bun.file(join(configRoot(), relPath)).text();
    const rubric = await loadPromptRubric();
    const result = parseDeep(relPath, await gen(buildDeepAuditPrompt(relPath, entry.kind, content, rubric)));
    if (result) await saveDeepAudit(result);
    return result;
  } catch (err) {
    logger.error({ err, relPath }, "deepAuditFile failed");
    return null;
  }
}
