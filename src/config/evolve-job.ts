// Orchestrateur du write-back : sélectionne les propositions pending autorisées, en applique au
// plus maxPerCycle (cap anti-batch). Jamais pendant une consolidation batch (ARCADE_LOOP_ACTIVE).
import { buildGraduation, mergeWithJournal } from "./graduation.ts";
import { buildCoverage } from "./coverage.ts";
import { loadSettings } from "./settings.ts";
import { loadBanned } from "./banned.ts";
import { loadJournal } from "./proposals-store.ts";
import { applyProposal } from "./apply.ts";
import { scanConfig } from "./scan.ts";
import { loadAllSummaries, loadCanonicalRegistry, loadChampions, loadPrinciples } from "../consolidate/store.ts";
import { logger } from "../logger.ts";
import type { AutoSettings, Proposal, ProposalKind } from "./types.ts";
import type { SkillUsage } from "../types.ts";

const TOGGLE: Record<ProposalKind, keyof AutoSettings> = {
  patch: "autoPatch", create: "autoCreate", archive: "autoArchive",
};

/** Propositions pending courantes (assemblées hors serveur). skillUsage optionnel (archive auto OFF). */
export async function pendingProposals(skillUsage: SkillUsage[] = []): Promise<Proposal[]> {
  const [tree, summaries, registry, champions, banned, principles, journal] = await Promise.all([
    scanConfig(), loadAllSummaries(), loadCanonicalRegistry(), loadChampions(), loadBanned(),
    loadPrinciples(), loadJournal(),
  ]);
  const coverage = buildCoverage(
    summaries, registry, champions ?? { generatedAt: 0, categories: [] }, skillUsage, tree.entries, banned,
  );
  const live = buildGraduation(principles ?? { generatedAt: 0, domains: [] }, coverage, tree.entries);
  return mergeWithJournal(live, journal).filter((p) => p.status === "pending");
}

export interface EvolutionRun { applied: number; rejected: number; skipped: number }

/** Applique les propositions pending autorisées, plafonné. Respecte le kill-switch + les toggles. */
export async function runEvolution(skillUsage: SkillUsage[] = []): Promise<EvolutionRun> {
  if (process.env.ARCADE_LOOP_ACTIVE === "1") return { applied: 0, rejected: 0, skipped: 0 };
  const settings = await loadSettings();
  if (!settings.autoGenerate) return { applied: 0, rejected: 0, skipped: 0 };
  const pending = (await pendingProposals(skillUsage)).filter((p) => settings[TOGGLE[p.kind]] === true);
  const batch = pending.slice(0, settings.maxPerCycle);
  let applied = 0, rejected = 0;
  for (const p of batch) {
    const res = await applyProposal(p);
    if (res.status === "applied") applied += 1; else rejected += 1;
  }
  if (batch.length) logger.info({ applied, rejected, capped: pending.length > batch.length }, "auto-évolution appliquée");
  return { applied, rejected, skipped: pending.length - batch.length };
}
