// Extraction et validation robustes du JSON produit par le `claude -p` de résumé.
// Isolé du spawn pour être testable unitairement.
import type { SummaryFields } from "./types.ts";

/** Déballe l'enveloppe `--output-format json` de Claude (`{ result: "..." }`). */
export function envelopeResult(raw: string): string {
  try {
    const env = JSON.parse(raw) as { result?: unknown };
    if (typeof env.result === "string") return env.result;
  } catch {
    // pas une enveloppe — on garde le texte brut
  }
  return raw;
}

/** Extrait le premier objet JSON équilibré d'un texte bruité (tolère prose autour). */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** Narrowing strict d'un objet inconnu vers SummaryFields (valeurs sûres par défaut). */
export function validateSummary(obj: unknown): SummaryFields | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const rawScore = typeof o.quality_score === "number" ? o.quality_score : Number(o.quality_score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  return {
    project: typeof o.project === "string" ? o.project : "",
    topic: typeof o.topic === "string" && o.topic.trim() ? o.topic.trim() : "inconnu",
    wins: strArr(o.wins),
    errors_claude: strArr(o.errors_claude),
    errors_chris: strArr(o.errors_chris),
    decisions: strArr(o.decisions),
    quality_score: score,
    links_hint: strArr(o.links_hint),
  };
}
