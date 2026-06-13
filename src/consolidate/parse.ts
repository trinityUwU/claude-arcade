// Extraction et validation robustes du JSON produit par le `claude -p` de résumé.
// Isolé du spawn pour être testable unitairement.
import type {
  SummaryFields,
  Problem,
  ResolutionSchema,
  DifficultyLevel,
  ProblemSeverity,
  ResolutionOutcome,
  Principle,
  PrinciplePolarity,
  PrincipleSource,
  CanonicalHint,
} from "./types.ts";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["easy", "medium", "hard"];
const PROBLEM_SEVERITIES: readonly ProblemSeverity[] = ["trivial", "minor", "major"];
const RESOLUTION_OUTCOMES: readonly ResolutionOutcome[] = ["resolved", "partial", "unresolved"];
const PRINCIPLE_POLARITIES: readonly PrinciplePolarity[] = ["positive", "negative"];
const PRINCIPLE_SOURCES: readonly PrincipleSource[] = ["stated", "inferred"];

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

/** Coerce vers un entier borné par min, avec valeur par défaut si non finie. */
function clampInt(v: unknown, min: number, def: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.round(n));
}

/** Narrow une valeur vers un membre de la liste, sinon le fallback. */
function narrowEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  // casts justifiés : `.includes` exige string[], puis v est prouvé ∈ allowed donc bien T
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function validateDifficulty(v: unknown): { level: DifficultyLevel; why: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    level: narrowEnum(o.level, DIFFICULTY_LEVELS, "medium"),
    why: typeof o.why === "string" ? o.why : "",
  };
}

function validateResolution(v: unknown): ResolutionSchema {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    steps: strArr(o.steps),
    tools_used: strArr(o.tools_used),
    turns_to_resolve: clampInt(o.turns_to_resolve, 1, 1),
    backtracks: clampInt(o.backtracks, 0, 0),
    tool_errors: clampInt(o.tool_errors, 0, 0),
    outcome: narrowEnum(o.outcome, RESOLUTION_OUTCOMES, "resolved"),
  };
}

/** Narrow le hint de classe canonique, ou undefined si absent/vide de nom. */
function validateCanonicalHint(v: unknown): CanonicalHint | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!name && !id) return undefined;
  return { id, name, definition: typeof o.definition === "string" ? o.definition.trim() : "" };
}

/** Narrow une entrée problème, ou null si description/category vides. */
function validateProblem(v: unknown, i: number): Problem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const category = typeof o.category === "string" ? o.category.trim() : "";
  if (!description || !category) return null;
  const hint = validateCanonicalHint(o.canonical_class);
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : `p${i + 1}`,
    description,
    category,
    severity: narrowEnum(o.severity, PROBLEM_SEVERITIES, "minor"),
    resolution_schema: validateResolution(o.resolution_schema),
    ...(hint ? { canonicalHint: hint } : {}),
  };
}

function validateProblems(v: unknown): Problem[] {
  if (!Array.isArray(v)) return [];
  const out: Problem[] = [];
  for (let i = 0; i < v.length; i++) {
    const p = validateProblem(v[i], i);
    if (p) out.push(p);
  }
  return out;
}

/** Narrow une entrée principe, ou null si statement/domain vides. */
function validatePrinciple(v: unknown, i: number): Principle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const statement = typeof o.statement === "string" ? o.statement.trim() : "";
  const domain = typeof o.domain === "string" ? o.domain.trim() : "";
  if (!statement || !domain) return null;
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : `pr${i + 1}`,
    statement,
    domain,
    trigger: typeof o.trigger === "string" ? o.trigger.trim() : "",
    polarity: narrowEnum(o.polarity, PRINCIPLE_POLARITIES, "positive"),
    source: narrowEnum(o.source, PRINCIPLE_SOURCES, "inferred"),
    rationale: typeof o.rationale === "string" ? o.rationale.trim() : "",
  };
}

function validatePrinciples(v: unknown): Principle[] {
  if (!Array.isArray(v)) return [];
  const out: Principle[] = [];
  for (let i = 0; i < v.length; i++) {
    const p = validatePrinciple(v[i], i);
    if (p) out.push(p);
  }
  return out;
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
    difficulty: validateDifficulty(o.difficulty),
    problems: validateProblems(o.problems),
    principles: validatePrinciples(o.principles), // absent (v1/v2) → [] (rétro-compat)
  };
}
