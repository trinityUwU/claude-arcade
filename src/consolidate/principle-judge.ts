// Couche (B) — juge LLM : compare les approches concurrentes d'un domaine (pour/contre +
// puissance), mémoïsé par signature. Déclenché manuellement (coût borné), jamais en consolidation.
import { loadAllSummaries, loadJudgments, saveJudgments } from "./store.ts";
import { buildPrinciples, eligibleForJudgment } from "./principles.ts";
import { normalizeText } from "./text-normalize.ts";
import { runIsolatedClaude, defaultModel } from "./summarize.ts";
import { envelopeResult, extractJson } from "./parse.ts";
import { buildJudgePrompt, type ApproachInput } from "./judge-prompt.ts";
import { rebuildInsights } from "./run.ts";
import type {
  PrincipleEntry, PrincipleInstance, PrincipleJudgment, RankedApproach,
} from "./types.ts";
import { logger } from "../logger.ts";

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}
function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function validateRanked(v: unknown): RankedApproach[] {
  if (!Array.isArray(v)) return [];
  const out: RankedApproach[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const statement = typeof o.statement === "string" ? o.statement.trim() : "";
    if (!statement) continue;
    out.push({ statement, power: clamp01(o.power), pros: strArr(o.pros), cons: strArr(o.cons) });
  }
  return out.sort((a, b) => b.power - a.power);
}

/** Narrow le JSON du juge, ou null si inexploitable (pas de classement). */
export function validateJudgment(raw: unknown, signature: string, model: string): PrincipleJudgment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ranked = validateRanked(o.ranked);
  if (ranked.length === 0) return null;
  return {
    synthesis: typeof o.synthesis === "string" ? o.synthesis.trim() : "",
    ranked,
    recommendation: typeof o.recommendation === "string" ? o.recommendation.trim() : "",
    signature, model, judgedAt: Date.now(),
  };
}

/** Regroupe les instances par énoncé distinct → approches comparables (représentant + count). */
function toApproaches(instances: PrincipleInstance[]): ApproachInput[] {
  const groups = new Map<string, PrincipleInstance[]>();
  for (const inst of instances) {
    const key = normalizeText(inst.statement);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(inst);
  }
  return [...groups.values()].map((group) => {
    const rep = [...group].sort((a, b) => b.at - a.at)[0]!;
    return {
      statement: rep.statement, polarity: rep.polarity, trigger: rep.trigger,
      rationale: rep.rationale, count: group.length,
      source: group.some((i) => i.source === "stated") ? "stated" : "inferred",
    };
  });
}

async function judgeOneDomain(
  entry: PrincipleEntry, model: string, timeoutMs: number,
): Promise<PrincipleJudgment | null> {
  try {
    const prompt = buildJudgePrompt(entry.label, toApproaches(entry.instances));
    const raw = await runIsolatedClaude(prompt, model, timeoutMs);
    const judgment = validateJudgment(extractJson(envelopeResult(raw)), entry.signature, model);
    if (!judgment) logger.warn({ domain: entry.domain }, "jugement : JSON non extractible");
    return judgment;
  } catch (err) {
    logger.error({ err, domain: entry.domain }, "judgeOneDomain failed");
    return null;
  }
}

export interface JudgeOptions {
  model?: string;
  timeoutMs?: number;
  onProgress?: (done: number, total: number) => void;
  shouldStop?: () => boolean;
}

/** Domaines éligibles (2+ énoncés distincts) et combien restent à juger (signature périmée/absente). */
export async function judgeCounts(): Promise<{ eligible: number; pending: number }> {
  const data = buildPrinciples(await loadAllSummaries(), await loadJudgments());
  const eligible = data.domains.filter(eligibleForJudgment);
  return { eligible: eligible.length, pending: eligible.filter((e) => !e.judgment).length };
}

/** Juge les domaines éligibles dont le jugement manque ou est périmé. Réécrit judgments.json + rebuild. */
export async function judgePrinciples(opts: JudgeOptions = {}): Promise<{ judged: number; eligible: number }> {
  if (process.env.ARCADE_LOOP_ACTIVE === "1") return { judged: 0, eligible: 0 }; // jamais en consolidation
  const model = opts.model ?? defaultModel();
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const existing = await loadJudgments();
  const data = buildPrinciples(await loadAllSummaries(), existing);
  const eligible = data.domains.filter(eligibleForJudgment);
  const stale = eligible.filter((e) => !e.judgment);
  const byDomain = { ...existing.byDomain };
  let judged = 0;
  for (const entry of stale) {
    if (opts.shouldStop?.()) break;
    const judgment = await judgeOneDomain(entry, model, timeoutMs);
    if (judgment) { byDomain[entry.domain] = judgment; judged++; }
    opts.onProgress?.(judged, stale.length);
  }
  await saveJudgments({ generatedAt: Date.now(), byDomain });
  await rebuildInsights();
  logger.info({ judged, eligible: eligible.length }, "jugement des principes terminé");
  return { judged, eligible: eligible.length };
}
