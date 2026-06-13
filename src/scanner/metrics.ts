// Analyse d'une session (liste de lignes JSONL) → compteurs + métadonnées.
import type { TranscriptLine, SessionStats, Counters, SessionMeta } from "../types.ts";
import * as T from "./tool-classify.ts";

interface Block { type?: string; name?: string; input?: Record<string, unknown>; is_error?: boolean; content?: unknown }

function blocksOf(line: TranscriptLine): Block[] {
  const c = line.message?.content;
  return Array.isArray(c) ? (c as Block[]) : [];
}

function resultText(block: Block): string {
  if (typeof block.content === "string") return block.content;
  if (Array.isArray(block.content)) {
    return block.content
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : ""))
      .join(" ");
  }
  return "";
}

const PERMISSION_RE = /permission denied|EACCES|operation not permitted/i;
const PORT_RE = /EADDRINUSE|address already in use|port \d+.*(in use|taken|already)/i;

function bump(c: Counters, key: string, n = 1): void {
  c[key] = (c[key] ?? 0) + n;
}

interface UseSinks { c: Counters; tools: Set<string>; files: Set<string>; mcp: Set<string>; skills: Counters }

function handleToolUse(name: string, input: Record<string, unknown>, s: UseSinks): void {
  const { c, tools, files, mcp, skills } = s;
  bump(c, "total_tool_calls");
  tools.add(name);
  if (T.isBash(name)) bump(c, "total_bash_calls");
  if (T.isTask(name)) bump(c, "total_task_calls");
  if (T.isSkill(name)) {
    bump(c, "skill_invocations");
    const sk = typeof input?.skill === "string" ? input.skill.trim() : "";
    if (sk) bump(skills, sk);
  }
  if (T.isWebSearch(name)) bump(c, "web_searches");
  if (T.isMemoryWrite(name)) bump(c, "memory_writes");
  if (T.isCodeIndex(name)) bump(c, "codeindex_queries");
  if (T.isBrowser(name)) bump(c, "browser_actions");
  if (T.isLogRead(name)) bump(c, "log_read_events");
  const server = T.mcpServer(name);
  if (server) mcp.add(server);
  const fp = typeof input?.file_path === "string" ? input.file_path : null;
  if (fp) {
    files.add(fp);
    if (T.isFileEdit(name)) {
      bump(c, "total_file_edits");
      if (T.isFrontendPath(fp)) bump(c, "frontend_activity");
    }
  }
}

function handleToolResult(block: Block, c: Counters): void {
  if (!block.is_error) return;
  bump(c, "total_errors");
  const text = resultText(block);
  if (PERMISSION_RE.test(text)) bump(c, "permission_denied_events");
  if (PORT_RE.test(text)) bump(c, "port_conflict_events");
}

function deriveMeta(
  file: string, sessionId: string, firstTs: number,
  models: Set<string>, mcp: Set<string>, tools: Set<string>, msgCount: number,
): SessionMeta {
  const d = firstTs ? new Date(firstTs) : null;
  const day = d ? d.getDay() : -1;
  const hour = d ? d.getHours() : -1;
  return {
    sessionId, file, startTs: firstTs,
    isWeekend: day === 0 || day === 6,
    isNight: hour >= 0 && hour < 6,
    models: [...models], mcpServers: [...mcp],
    messageCount: msgCount, distinctTools: tools.size,
  };
}

export function analyzeSession(lines: TranscriptLine[], file: string): SessionStats {
  const c: Counters = {}, skills: Counters = {};
  const tools = new Set<string>(), files = new Set<string>(), mcp = new Set<string>(), models = new Set<string>();
  let firstTs = 0, sessionId = "", msgCount = 0;
  for (const line of lines) {
    if (!sessionId && line.sessionId) sessionId = line.sessionId;
    const ts = line.timestamp ? Date.parse(line.timestamp) : 0;
    if (ts && (!firstTs || ts < firstTs)) firstTs = ts;
    if (line.type === "assistant" || line.type === "user") msgCount++;
    if (line.type === "assistant" && line.message?.model) models.add(line.message.model);
    for (const b of blocksOf(line)) {
      if (b.type === "tool_use" && b.name) handleToolUse(b.name, b.input ?? {}, { c, tools, files, mcp, skills });
      else if (b.type === "tool_result") handleToolResult(b, c);
    }
  }
  c.max_files_touched_in_session = files.size;
  c.max_distinct_tools_in_session = tools.size;
  c.max_messages_in_session = msgCount;
  return { counters: c, skills, meta: deriveMeta(file, sessionId || file, firstTs, models, mcp, tools, msgCount) };
}
