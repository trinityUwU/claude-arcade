// Réduit un transcript JSONL volumineux en un digest texte compact et borné.
// C'est l'entrée du `claude -p` de résumé : il contrôle précisément le coût en tokens.
import type { TranscriptLine } from "../types.ts";

interface Block {
  type?: string; name?: string; text?: string;
  input?: Record<string, unknown>; is_error?: boolean; content?: unknown;
}

export interface TranscriptDigest {
  project: string;
  sessionId: string;
  models: string[];
  messageCount: number;
  text: string;
  startTs: number; // epoch ms réel de la session (1er timestamp du transcript), 0 si inconnu
}

const TURN_CHARS = 800; // troncature par bloc de texte
const TOTAL_CHARS = 16000; // budget total du digest (head + tail)
const INPUT_KEYS = ["file_path", "command", "query", "pattern", "description", "prompt", "url", "skill"];

function blocksOf(line: TranscriptLine): Block[] {
  const c = line.message?.content;
  return Array.isArray(c) ? (c as Block[]) : [];
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function textOf(block: Block): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : ""))
      .join(" ");
  }
  return "";
}

function inputSummary(input: Record<string, unknown>): string {
  for (const key of INPUT_KEYS) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return `${key}=${clip(v, 80)}`;
  }
  return "";
}

function renderBlocks(line: TranscriptLine, out: string[]): void {
  const texts: string[] = [];
  for (const b of blocksOf(line)) {
    if (b.type === "text" && typeof b.text === "string") texts.push(clip(b.text, TURN_CHARS));
    else if (b.type === "tool_use" && b.name) texts.push(`[tool:${b.name} ${inputSummary(b.input ?? {})}]`.trim());
    else if (b.type === "tool_result" && b.is_error) texts.push(`[ERREUR: ${clip(textOf(b), 160)}]`);
  }
  if (texts.length) out.push(`[${line.type?.toUpperCase()}] ${texts.join(" ")}`);
}

/** Capture le texte d'un message simple (role user/assistant sans blocs structurés). */
function renderPlain(line: TranscriptLine, out: string[]): void {
  const c = line.message?.content;
  if (typeof c === "string" && c.trim()) out.push(`[${line.type?.toUpperCase()}] ${clip(c, TURN_CHARS)}`);
}

function capHeadTail(lines: string[], budget: number): string {
  const joined = lines.join("\n");
  if (joined.length <= budget) return joined;
  const head = Math.floor(budget * 0.5);
  const tail = budget - head;
  return `${joined.slice(0, head)}\n…[${joined.length - budget} caractères omis au milieu]…\n${joined.slice(-tail)}`;
}

export function digestTranscript(lines: TranscriptLine[]): TranscriptDigest {
  const models = new Set<string>();
  const out: string[] = [];
  let project = "", sessionId = "", messageCount = 0, startTs = 0;
  for (const line of lines) {
    if (line.isSidechain) continue; // les sous-agents ne portent pas le fil principal
    if (!project && line.cwd) project = line.cwd;
    if (!sessionId && line.sessionId) sessionId = line.sessionId;
    if (line.type === "assistant" && line.message?.model) models.add(line.message.model);
    if (line.type !== "user" && line.type !== "assistant") continue;
    if (!startTs && line.timestamp) {
      const ts = Date.parse(line.timestamp);
      if (Number.isFinite(ts) && ts > 0) startTs = ts;
    }
    messageCount++;
    if (Array.isArray(line.message?.content)) renderBlocks(line, out);
    else renderPlain(line, out);
  }
  return { project, sessionId, models: [...models], messageCount, text: capHeadTail(out, TOTAL_CHARS), startTs };
}
