// Transcript nettoyé pour affichage humain (panneau de détail du graphe).
// Tours user/assistant lisibles : prose + outils appelés + erreurs. Borné mais non tronqué brutalement.
import type { TranscriptLine } from "../types.ts";

interface Block {
  type?: string; name?: string; text?: string;
  input?: Record<string, unknown>; is_error?: boolean; content?: unknown;
}

export interface ViewTurn {
  role: "user" | "assistant";
  text: string;
  tools: string[];
  errors: string[];
}

export interface TranscriptView {
  sessionId: string;
  project: string;
  turnCount: number;
  turns: ViewTurn[];
}

const MAX_TURNS = 240;
const TURN_CHARS = 4000;
const INPUT_KEYS = ["file_path", "command", "query", "pattern", "url", "description"];

function blocksOf(line: TranscriptLine): Block[] {
  const c = line.message?.content;
  return Array.isArray(c) ? (c as Block[]) : [];
}

/** Retire le bruit injecté par le harness (caveats, system-reminder, wrappers de commande). */
function sanitize(s: string): string {
  return s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<command-(name|message|args|contents)>([\s\S]*?)<\/command-\1>/g, "$2 ")
    .replace(/<\/?[a-z-]+>/g, "")
    .trim();
}

function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function toolLabel(b: Block): string {
  for (const k of INPUT_KEYS) {
    const v = b.input?.[k];
    if (typeof v === "string" && v.trim()) return `${b.name} · ${clip(v.replace(/\s+/g, " "), 70)}`;
  }
  return b.name ?? "tool";
}

function errorText(b: Block): string {
  if (typeof b.content === "string") return clip(b.content, 200);
  if (Array.isArray(b.content)) {
    const t = b.content
      .map((x) => (x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text) : ""))
      .join(" ");
    return clip(t, 200);
  }
  return "";
}

function buildTurn(line: TranscriptLine): ViewTurn | null {
  const role = line.type === "user" ? "user" : "assistant";
  const texts: string[] = [], tools: string[] = [], errors: string[] = [];
  const c = line.message?.content;
  if (typeof c === "string") texts.push(c);
  for (const b of blocksOf(line)) {
    if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
    else if (b.type === "tool_use" && b.name) tools.push(toolLabel(b));
    else if (b.type === "tool_result" && b.is_error) errors.push(errorText(b));
  }
  const text = clip(sanitize(texts.join("\n\n")), TURN_CHARS);
  if (!text && !tools.length && !errors.length) return null;
  return { role, text, tools, errors };
}

export function cleanTranscript(lines: TranscriptLine[]): TranscriptView {
  const turns: ViewTurn[] = [];
  let project = "", sessionId = "";
  for (const line of lines) {
    if (line.isSidechain) continue;
    if (!project && line.cwd) project = line.cwd;
    if (!sessionId && line.sessionId) sessionId = line.sessionId;
    if (line.type !== "user" && line.type !== "assistant") continue;
    const turn = buildTurn(line);
    if (turn) turns.push(turn);
  }
  return { sessionId, project, turnCount: turns.length, turns: turns.slice(0, MAX_TURNS) };
}
