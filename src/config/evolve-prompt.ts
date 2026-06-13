// Prompts de génération pour le write-back. Sortie JSON {"content": "..."} (cohérent avec le
// SYSTEM extracteur de runIsolatedClaude). Principe-architect appliqué : rôle, contraintes, format.

const PATCH_RULES = [
  "INTÈGRE le principe dans le corps du skill — ne l'ajoute PAS en bloc à la fin.",
  "Reformule, condense ou remplace les instructions existantes. Économie de tokens : ne rallonge pas inutilement.",
  "Préserve le frontmatter YAML (name, description, etc.) et le sens global du skill.",
  "Garde le style, le ton et le format du skill d'origine.",
];

export function buildPatchPrompt(skillName: string, current: string, principle: string): string {
  return [
    `Tu fais évoluer le skill Claude Code « ${skillName} » pour y ancrer un principe de travail validé par l'usage.`,
    `PRINCIPE À INTÉGRER : ${principle}`,
    "RÈGLES :", ...PATCH_RULES.map((r) => `- ${r}`),
    "SKILL ACTUEL :", "```", current, "```",
    'Réponds UNIQUEMENT par un objet JSON : {"content": "<le skill réécrit EN ENTIER>"}',
  ].join("\n");
}

export function buildCreatePrompt(className: string, definition: string, projects: string[]): string {
  const seen = projects.length ? ` Rencontrée dans : ${projects.join(", ")}.` : "";
  return [
    `Crée un nouveau skill Claude Code pour une classe de problème récurrente.${seen}`,
    `CLASSE : ${className}`,
    `DÉFINITION : ${definition}`,
    "Le skill DOIT : commencer par un frontmatter YAML (name en kebab-case, description avec les triggers d'usage),",
    "puis une procédure concise et actionnable pour cette classe de problème. Précis, zéro remplissage.",
    'Réponds UNIQUEMENT par un objet JSON : {"content": "<le SKILL.md complet>"}',
  ].join("\n");
}
