// Classification d'un nom d'outil Claude Code vers les métriques d'achievements.

const FILE_EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const TASK_TOOLS = new Set(["Task", "Agent"]);
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);
const FRONTEND_EXT = /\.(tsx|jsx|css|scss|sass|svg|html|vue)$/i;

export function isFileEdit(name: string): boolean {
  return FILE_EDIT_TOOLS.has(name);
}
export function isTask(name: string): boolean {
  return TASK_TOOLS.has(name);
}
export function isBash(name: string): boolean {
  return name === "Bash";
}
export function isSkill(name: string): boolean {
  return name === "Skill";
}
export function isWebSearch(name: string): boolean {
  return WEB_TOOLS.has(name);
}
export function isMemoryWrite(name: string): boolean {
  return name.startsWith("mcp__semantic-memory__memory_store")
    || name.startsWith("mcp__semantic-memory__profile_store");
}
export function isCodeIndex(name: string): boolean {
  return name.startsWith("mcp__codeindex__");
}
export function isBrowser(name: string): boolean {
  return name.startsWith("mcp__playwright__");
}
export function isLogRead(name: string): boolean {
  return name.startsWith("mcp__log-watcher__");
}

/** Serveur MCP d'un nom d'outil (`mcp__<server>__tool`), ou null. */
export function mcpServer(name: string): string | null {
  const m = name.match(/^mcp__([^_]+(?:-[^_]+)*)__/);
  return m ? (m[1] ?? null) : null;
}

export function isFrontendPath(path: string): boolean {
  return FRONTEND_EXT.test(path);
}

/** Famille de modèle pour les badges « Model Lore ». */
export function modelFamily(model: string): string | null {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("fable")) return "fable";
  return null;
}

/** Modèle local (routé EchoHub chez Chris : haiku → Qwen local). */
export function isLocalModel(model: string): boolean {
  return /haiku/i.test(model);
}
