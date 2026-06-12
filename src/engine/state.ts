// Persistance locale de l'état d'unlock (IDs stables) + détection des nouveaux paliers.
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { AchievementResult } from "../types.ts";
import { logger } from "../logger.ts";

export interface UnlockRecord { tierIndex: number; firstAt: number; lastTierAt: number }
export interface RecentUnlock { id: string; name: string; tierName: string; at: number }
export interface ArcadeState {
  schemaVersion: number;
  unlocks: Record<string, UnlockRecord>;
  recent: RecentUnlock[];
}

const RECENT_CAP = 50;

export function stateDir(): string {
  return process.env.ARCADE_STATE_DIR?.trim() || join(homedir(), ".claude", "claude-arcade");
}
function statePath(): string {
  return join(stateDir(), "state.json");
}

export async function loadState(): Promise<ArcadeState> {
  try {
    const file = Bun.file(statePath());
    if (await file.exists()) return (await file.json()) as ArcadeState;
  } catch (err) {
    logger.error({ err }, "loadState failed — repart d'un état vide");
  }
  return { schemaVersion: 1, unlocks: {}, recent: [] };
}

export async function saveState(state: ArcadeState): Promise<void> {
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(statePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    logger.error({ err }, "saveState failed");
  }
}

/** Met à jour l'état avec les résultats courants, retourne les nouveaux paliers franchis. */
export function reconcile(results: AchievementResult[], state: ArcadeState, now = Date.now()): RecentUnlock[] {
  const fresh: RecentUnlock[] = [];
  for (const r of results) {
    if (r.tierIndex < 0) continue;
    const prev = state.unlocks[r.id];
    if (!prev) {
      state.unlocks[r.id] = { tierIndex: r.tierIndex, firstAt: now, lastTierAt: now };
      fresh.push({ id: r.id, name: r.name, tierName: r.tierName ?? "Copper", at: now });
    } else if (r.tierIndex > prev.tierIndex) {
      prev.tierIndex = r.tierIndex;
      prev.lastTierAt = now;
      fresh.push({ id: r.id, name: r.name, tierName: r.tierName ?? "Copper", at: now });
    }
  }
  if (fresh.length) state.recent = [...fresh, ...state.recent].slice(0, RECENT_CAP);
  return fresh;
}
