// Prompt du juge de principes : compare les approches concurrentes d'un même domaine
// (pour/contre + puissance relative). JSON-only, déterministe, français.

export interface ApproachInput {
  statement: string;
  polarity: "positive" | "negative";
  trigger: string;
  rationale: string;
  count: number;        // nb d'occurrences de cet énoncé
  source: "stated" | "inferred";
}

const PROMPT = `Tu es un juge de méthodes de travail. On te donne plusieurs APPROCHES concurrentes observées dans un même DOMAINE de pensée, issues de sessions de développement avec un utilisateur. Tu produis UNIQUEMENT un objet JSON valide qui les compare. Aucun autre texte.

TÂCHE
Compare les approches entre elles : leurs forces, leurs faiblesses, et leur PUISSANCE relative (quelle méthode est la plus solide et généralisable). Puis tranche une recommandation actionnable.

INSTRUCTIONS
1. Pour chaque approche : pros[] (ses forces concrètes), cons[] (ses limites, risques, angles morts), et power (0 à 1) = sa puissance relative jugée — la meilleure approche du domaine approche 1, une approche faible ou trop situationnelle est basse.
2. Tiens compte de la fréquence (count), de la source (stated = règle explicite de l'utilisateur, à fort poids ; inferred = déduite), et de la polarité (positive = à faire / negative = à éviter).
3. synthesis : 1-3 phrases qui comparent les approches entre elles, factuel.
4. recommendation : la directive retenue, formulée comme une règle actionnable réutilisable. Si deux approches sont complémentaires (pas en conflit), la reco les combine. Si elles s'opposent, la reco tranche en faveur de la plus puissante et dit pourquoi.

À NE PAS FAIRE
- Ne PAS inventer de contenu absent des approches fournies.
- Ne PAS émettre de markdown, de balises de code, ni de texte hors du JSON.
- Ne PAS noter toutes les approches à la même puissance : différencie.

FORMAT DE SORTIE (JSON pur)
{"synthesis":string,"ranked":[{"statement":string,"power":number,"pros":string[],"cons":string[]}],"recommendation":string}
- ranked : reprend EXACTEMENT les statements fournis (un par approche), classés par power décroissant.

DOMAINE ET APPROCHES À JUGER :
`;

function renderApproaches(approaches: ApproachInput[]): string {
  return approaches
    .map((a, i) => {
      const tags = `[${a.polarity} · ${a.source} · vu ${a.count}×]`;
      const ctx = [a.trigger && `quand: ${a.trigger}`, a.rationale && `motif: ${a.rationale}`]
        .filter(Boolean)
        .join(" · ");
      return `Approche ${i + 1} ${tags} : ${a.statement}${ctx ? `\n   (${ctx})` : ""}`;
    })
    .join("\n");
}

export function buildJudgePrompt(label: string, approaches: ApproachInput[]): string {
  return `${PROMPT}Domaine : ${label}\n${renderApproaches(approaches)}\n\nRappel : réponds UNIQUEMENT par le JSON.`;
}
