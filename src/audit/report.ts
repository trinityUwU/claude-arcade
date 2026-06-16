// Orchestration du diagnostic déterministe : scan → lecture contenu → règles → grade → synthèse.
import { join } from "node:path";
import { scanConfig } from "../config/scan.ts";
import { configRoot } from "../config/paths.ts";
import { logger } from "../logger.ts";
import { runHeuristics, estTokens } from "./heuristics.ts";
import { scoreFromFlags, gradeFromFlags } from "./grade.ts";
import { buildChecks } from "./checks.ts";
import { loadDeepAudits } from "./deep-store.ts";
import { loadAllUpgrades } from "./upgrade-store.ts";
import type { DeepAudit, Upgrade } from "./types.ts";
import type {
  AuditCode, AuditGrade, AuditReport, AuditSummary, EntryAudit,
} from "./types.ts";
import type { ConfigEntry } from "../config/types.ts";

const EMPTY_GRADES: Record<AuditGrade, number> = {
  excellent: 0, solid: 0, mediocre: 0, overloaded: 0, thin: 0,
};

async function auditEntry(
  entry: ConfigEntry, deepMap: Record<string, DeepAudit>, upgradeMap: Record<string, Upgrade[]>,
): Promise<EntryAudit | null> {
  try {
    const content = await Bun.file(join(configRoot(), entry.relPath)).text();
    const flags = runHeuristics(entry, content);
    const score = scoreFromFlags(flags);
    const deep = deepMap[entry.relPath];
    const upgrades = upgradeMap[entry.relPath] ?? [];
    // Drift : déjà upgradé mais le disque diffère du dernier `after` → modifié hors Arcade.
    const drifted = upgrades.length > 0 && upgrades[0]!.after !== content;
    return {
      relPath: entry.relPath, kind: entry.kind, name: entry.name,
      bytes: entry.bytes, estTokens: estTokens(entry.bytes),
      grade: gradeFromFlags(flags, score), score, flags,
      checks: buildChecks(entry.kind, flags),
      upgradeCount: upgrades.length,
      ...(drifted ? { drifted } : {}),
      ...(deep ? { deep } : {}),
    };
  } catch (err) {
    logger.error({ err, relPath: entry.relPath }, "auditEntry failed");
    return null;
  }
}

function summarize(entries: EntryAudit[]): AuditSummary {
  const byGrade = { ...EMPTY_GRADES };
  const issues = new Map<AuditCode, number>();
  let totalTokens = 0;
  for (const e of entries) {
    byGrade[e.grade]++;
    totalTokens += e.estTokens;
    for (const f of e.flags) issues.set(f.code, (issues.get(f.code) ?? 0) + 1);
  }
  const topIssues = [...issues.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  return { total: entries.length, byGrade, totalTokens, topIssues };
}

/** Diagnostic complet de la config, déterministe et gratuit (zéro token). */
export async function auditConfig(): Promise<AuditReport> {
  const tree = await scanConfig();
  const [deepMap, upgradeMap] = await Promise.all([loadDeepAudits(), loadAllUpgrades()]);
  const audited = await Promise.all(tree.entries.map((e) => auditEntry(e, deepMap, upgradeMap)));
  const entries = audited.filter((e): e is EntryAudit => e !== null)
    .sort((a, b) => a.score - b.score);  // pires en premier (actionnable)
  return { generatedAt: Date.now(), configRoot: configRoot(), summary: summarize(entries), entries };
}
