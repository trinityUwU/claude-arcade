// Checklist des normes : applicabilité par type de fichier + libellé court des chips.
// Transforme les drapeaux d'échec en checklist vrai/faux complète (UI = chips booléens).
import type { ConfigKind } from "../config/types.ts";
import type { AuditCheck, AuditCode, AuditFlag } from "./types.ts";

interface CheckDef { code: AuditCode; label: string; kinds: readonly ConfigKind[] }

const PROMPT_KINDS: readonly ConfigKind[] = ["instruction", "skill", "command"];
const ALL_KINDS: readonly ConfigKind[] = ["instruction", "skill", "command", "setting"];

// Ordre = ordre d'affichage des chips.
const CHECK_DEFS: readonly CheckDef[] = [
  { code: "overloaded", label: "Taille", kinds: ALL_KINDS },
  { code: "thin", label: "Détail", kinds: PROMPT_KINDS },
  { code: "non-english", label: "Anglais", kinds: PROMPT_KINDS },
  { code: "no-description", label: "Description", kinds: ["skill", "command"] },
  { code: "no-trigger", label: "Trigger", kinds: ["skill"] },
  { code: "wall-of-text", label: "Structure", kinds: PROMPT_KINDS },
  { code: "over-prompting", label: "Sur-prompting", kinds: PROMPT_KINDS },
  { code: "negative-framing", label: "Cadrage positif", kinds: PROMPT_KINDS },
];

/** Construit la checklist complète : chaque norme applicable au kind, ok = pas de drapeau. */
export function buildChecks(kind: ConfigKind, flags: AuditFlag[]): AuditCheck[] {
  const failed = new Map(flags.map((f) => [f.code, f]));
  const checks: AuditCheck[] = [];
  for (const def of CHECK_DEFS) {
    if (!def.kinds.includes(kind)) continue;
    const flag = failed.get(def.code);
    checks.push({
      code: def.code, label: def.label, ok: !flag,
      severity: flag?.severity ?? "good",
      ...(flag ? { message: flag.message } : {}),
    });
  }
  return checks;
}
