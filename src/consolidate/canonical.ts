// Phase 1 — classes canoniques de problèmes : taxonomie évolutive qui reconnaît le
// « même problème » entre sessions/projets. Le LLM de consolidation (déjà payé, 1×/session)
// assigne chaque problème à une classe existante ou en crée une. Remplace le token-overlap.
// Ce module est déterministe et testable : il ne fait QUE résoudre les hints du LLM.
import type { Problem, CanonicalClass, CanonicalRegistry } from "./types.ts";
import { normalizeText, groupingKey } from "./text-normalize.ts";

export const CANONICAL_SCHEMA_VERSION = 1;
const MAX_INDEX_CLASSES = 60; // borne le contexte injecté dans le prompt de consolidation

export function emptyRegistry(): CanonicalRegistry {
  return { schemaVersion: CANONICAL_SCHEMA_VERSION, updatedAt: 0, classes: [] };
}

/** Slug stable depuis un nom de classe (lettres/chiffres → tirets). */
function slugify(name: string): string {
  const base = normalizeText(name).replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);
  return base.replace(/^-|-$/g, "") || "classe";
}

/** Garantit l'unicité d'un id dans le registre (suffixe -2, -3… si collision). */
function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Clé de regroupement d'un problème : sa classe canonique si résolue, sinon fallback
 *  token-overlap sur la catégorie (rétro-compat résumés v1-v3 jamais re-consolidés). */
export function problemKey(p: Problem): string {
  if (p.canonicalClassId && p.canonicalClassId.trim()) return p.canonicalClassId.trim();
  return groupingKey(p.category);
}

/** Index borné des classes existantes, injecté dans le prompt (id · nom · définition). */
export function canonicalIndexText(reg: CanonicalRegistry): string {
  const top = [...reg.classes]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, MAX_INDEX_CLASSES)
    .map((c) => `- ${c.id} · ${c.name} : ${c.definition}`)
    .join("\n");
  return top;
}

export interface ResolveResult {
  problems: Problem[];        // mêmes problèmes, canonicalClassId renseigné, hint retiré
  registry: CanonicalRegistry; // registre mis à jour (classes créées + occurrences)
  changed: boolean;           // true si le registre a été modifié (création / occurrence)
}

/** Résout les hints LLM en classes canoniques : rattache à l'existant (par id puis par nom
 *  normalisé) ou crée. Déterministe, idempotent par session. */
export function resolveCanonical(problems: Problem[], reg: CanonicalRegistry): ResolveResult {
  const classes = reg.classes.map((c) => ({ ...c }));
  const byId = new Map(classes.map((c) => [c.id, c]));
  const byName = new Map(classes.map((c) => [normalizeText(c.name), c]));
  const taken = new Set(classes.map((c) => c.id));
  let changed = false;

  const out: Problem[] = problems.map((p) => {
    const hint = p.canonicalHint;
    const { canonicalHint: _drop, ...rest } = p;
    if (!hint) return rest; // pas de hint → fallback groupingKey via problemKey

    let cls: CanonicalClass | undefined;
    if (hint.id.trim()) cls = byId.get(hint.id.trim());
    if (!cls && hint.name.trim()) cls = byName.get(normalizeText(hint.name));
    if (!cls && hint.name.trim()) {
      const id = uniqueId(slugify(hint.name), taken);
      taken.add(id);
      cls = {
        id, name: hint.name.trim(),
        definition: hint.definition.trim() || hint.name.trim(),
        createdAt: Date.now(), occurrences: 0,
      };
      classes.push(cls);
      byId.set(cls.id, cls);
      byName.set(normalizeText(cls.name), cls);
      changed = true;
    }
    if (!cls) return rest; // hint vide de nom → fallback
    cls.occurrences += 1;
    changed = true;
    return { ...rest, canonicalClassId: cls.id };
  });

  return {
    problems: out,
    registry: changed ? { ...reg, updatedAt: Date.now(), classes } : reg,
    changed,
  };
}
