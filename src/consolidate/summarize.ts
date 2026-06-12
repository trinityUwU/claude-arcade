// Résumé d'une session via `claude -p` headless, isolé et déterministe.
// Isolation : aucun MCP (strict-mcp-config + config vide), pas de persistance de
// session (anti-récursion), permission plan (lecture seule), system prompt minimal.
import { join } from "node:path";
import type { SummaryFields } from "./types.ts";
import { buildSummaryPrompt } from "./summary-prompt.ts";
import { envelopeResult, extractJson, validateSummary } from "./parse.ts";
import { logger } from "../logger.ts";

const SYSTEM = "Tu es un extracteur silencieux. Tu réponds uniquement par un objet JSON valide, sans aucun autre texte.";
const EMPTY_MCP = join(import.meta.dir, "empty-mcp.json");

// Modèle par défaut : abonnement Claude Code de Chris (cloud Anthropic, vrai Claude).
// `sonnet` forwarde toujours vers api.anthropic.com (jamais routé local), même si
// ANTHROPIC_BASE_URL pointe sur EchoHub. AUCUN modèle local pour ce projet.
export function defaultModel(): string {
  return process.env.ARCADE_SUMMARY_MODEL?.trim() || "sonnet";
}

function spawnArgs(model: string): string[] {
  return [
    "claude", "-p",
    "--output-format", "json",
    "--no-session-persistence",
    "--strict-mcp-config", "--mcp-config", EMPTY_MCP,
    "--permission-mode", "plan",
    "--system-prompt", SYSTEM,
    "--model", model,
  ];
}

async function runClaude(prompt: string, model: string, timeoutMs: number): Promise<string> {
  const proc = Bun.spawn(spawnArgs(model), {
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
    env: { ...process.env, ARCADE_LOOP_ACTIVE: "1" },
  });
  const killer = setTimeout(() => proc.kill(), timeoutMs);
  try {
    proc.stdin.write(prompt);
    await proc.stdin.end();
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`claude -p exit ${code}: ${err.slice(0, 300)}`);
    }
    return out;
  } finally {
    clearTimeout(killer);
  }
}

/** Résume un digest texte → champs structurés, ou null si échec/illisible. */
export async function summarizeDigest(
  digestText: string, model = defaultModel(), timeoutMs = 120_000,
): Promise<SummaryFields | null> {
  if (!digestText.trim()) return null;
  try {
    const raw = await runClaude(buildSummaryPrompt(digestText), model, timeoutMs);
    const fields = validateSummary(extractJson(envelopeResult(raw)));
    if (!fields) logger.warn("résumé : JSON non extractible");
    return fields;
  } catch (err) {
    logger.error({ err }, "summarizeDigest failed");
    return null;
  }
}
