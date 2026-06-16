// Prompt du verdict approfondi d'un fichier de config, jugé selon les normes Anthropic.
import type { ConfigKind } from "../config/types.ts";

const ROLE_HINT: Record<ConfigKind, string> = {
  instruction: "a global instruction file injected into EVERY session (context cost is permanent)",
  skill: "a Claude Code skill, loaded on demand by its description/trigger",
  command: "a slash command prompt template",
  setting: "a JSON settings file",
};

export function buildDeepAuditPrompt(relPath: string, kind: ConfigKind, content: string, rubric = ""): string {
  const rubricBlock = rubric
    ? ["=== SCORING RUBRIC (the project's native prompting standard — judge STRICTLY against this) ===", rubric, ""]
    : ["Judge it on: instruction clarity, XML/structure, English (the norm for Anthropic models),",
       "token economy (no bloat for its role), explicit triggers, and absence of contradictions.", ""];
  return [
    "You are a senior Claude Code prompt engineer auditing a config file against the native prompting principles below.",
    `The file \`${relPath}\` is ${ROLE_HINT[kind]}.`,
    "",
    ...rubricBlock,
    "Respond with ONLY a JSON object, no prose:",
    '{ "verdict": "excellent|solid|mediocre|overloaded|thin",',
    '  "strengths": ["..."], "issues": ["..."],',
    '  "rewriteHint": "one concrete, actionable improvement direction" }',
    "",
    "=== FILE CONTENT ===",
    content.slice(0, 24_000),
  ].join("\n");
}
