// Stream `claude -p` en JSONL (stream-json) : texte live token-par-token + coût final.
// Garde l'ISOLATION de runIsolatedClaude (zéro MCP, plan, anti-récursion) — indispensable,
// le snippet d'origine ne l'avait pas. Modèle par défaut sonnet (jamais opus pour l'audit).
import { join } from "node:path";
import { logger } from "../logger.ts";

const SYSTEM = "Tu es un auditeur de config Claude Code. Tu réponds en français, format markdown.";
const EMPTY_MCP = join(import.meta.dir, "..", "consolidate", "empty-mcp.json");

export interface StreamResult { text: string; costUsd: number; }
export type StreamRunner = (prompt: string, onText: (chunk: string) => void, model?: string) => Promise<StreamResult>;

interface Delta { type: string; text?: string }
interface StreamLine {
  type: string;
  event?: { type: string; delta?: Delta };
  total_cost_usd?: number;
}

function spawnArgs(model: string): string[] {
  return [
    "claude", "-p",
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",                       // requis par stream-json pour émettre les deltas
    "--no-session-persistence",
    "--strict-mcp-config", "--mcp-config", EMPTY_MCP,
    "--permission-mode", "plan",
    "--system-prompt", SYSTEM,
    "--model", model,
  ];
}

/** Consomme une ligne JSONL : accumule le texte (via onText) et capte le coût. */
function handleLine(line: string, onText: (c: string) => void): number | null {
  let evt: StreamLine;
  try { evt = JSON.parse(line) as StreamLine; } catch { return null; }
  if (evt.type === "stream_event" && evt.event?.type === "content_block_delta") {
    const d = evt.event.delta;
    if (d?.type === "text_delta" && d.text) onText(d.text);
  } else if (evt.type === "result" && typeof evt.total_cost_usd === "number") {
    return evt.total_cost_usd;
  }
  return null;
}

/** Lance claude -p en streaming. `onText` reçoit le texte live ; retourne l'accumulé + coût. */
export async function streamClaude(
  prompt: string, onText: (chunk: string) => void, model = "sonnet",
): Promise<StreamResult> {
  const proc = Bun.spawn(spawnArgs(model), {
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
    env: { ...process.env, ARCADE_LOOP_ACTIVE: "1" },
  });
  proc.stdin.write(prompt);
  await proc.stdin.end();

  let full = "", cost = 0, buffer = "";
  const decoder = new TextDecoder();
  const collect = (c: string): void => { full += c; onText(c); };
  const reader = proc.stdout.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";                 // garde la ligne partielle (réassemblage JSONL)
    for (const line of lines) {
      if (!line.trim()) continue;
      const c = handleLine(line, collect);
      if (c !== null) cost = c;
    }
  }
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    logger.error({ code, err: err.slice(0, 300) }, "streamClaude non-zéro");
    throw new Error(`claude exited ${code}`);
  }
  return { text: full, costUsd: cost };
}
