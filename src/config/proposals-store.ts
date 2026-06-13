// Journal persistant des propositions d'évolution config (statuts applied/rejected/failed).
// Survit aux rebuilds déterministes. La détection live (graduation.ts) y est fusionnée pour l'affichage.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";
import type { Proposal, ProposalsData } from "./types.ts";

const CAP = 500;

function journalPath(): string {
  return join(stateDir(), "config-proposals.json");
}

export async function loadJournal(): Promise<Proposal[]> {
  try {
    const f = Bun.file(journalPath());
    if (await f.exists()) {
      const d = (await f.json()) as ProposalsData;
      if (Array.isArray(d.proposals)) return d.proposals;
    }
  } catch (err) {
    logger.error({ err }, "loadJournal failed");
  }
  return [];
}

/** Enregistre l'issue d'une proposition (remplace toute entrée de même id). */
export async function recordProposal(p: Proposal): Promise<void> {
  const journal = await loadJournal();
  const next = [p, ...journal.filter((x) => x.id !== p.id)].slice(0, CAP);
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(journalPath(), JSON.stringify({ generatedAt: Date.now(), proposals: next }, null, 2));
  } catch (err) {
    logger.error({ err }, "recordProposal failed");
  }
}
