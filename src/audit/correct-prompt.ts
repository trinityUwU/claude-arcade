// Prompt de correction opus, STRICT : améliore le fichier selon l'analyse profonde,
// sans trahir son essence. Micro-règles non négociables (demande Chris).
import type { ConfigKind } from "../config/types.ts";

// Sentinelles d'extraction : robustes même si le fichier contient des ``` (cas markdown).
export const CORRECTION_START = "===ARCADE_CORRECTION_START===";
export const CORRECTION_END = "===ARCADE_CORRECTION_END===";

const ROLE: Record<ConfigKind, string> = {
  instruction: "un fichier d'instructions globales injecté à CHAQUE session",
  skill: "un skill Claude Code (chargé à la demande par sa description/trigger)",
  command: "un template de slash command",
  setting: "un fichier de réglages JSON",
};

export function buildCorrectPrompt(relPath: string, kind: ConfigKind, content: string, analysis: string, rubric = ""): string {
  return [
    "Tu es un prompt engineer Claude Code senior, EXIGEANT. Tu corriges un fichier de config selon une analyse.",
    `Fichier \`${relPath}\` — ${ROLE[kind]}.`,
    "",
    "RÈGLES NON NÉGOCIABLES :",
    "1. NE PERDS AUCUN détail important. Tu peux condenser/reformuler, mais tout ce qui porte du sens est conservé.",
    "2. NE SUPPRIME AUCUNE fonctionnalité, capacité, ou comportement du skill. Zéro perte de feature.",
    "3. GARDE L'ESSENCE : le fichier reste lui-même, mêmes intentions, même rôle. Tu corriges, tu ne réécris pas une autre chose.",
    "4. LANGUE = ANGLAIS. La norme pour un fichier de config lu par un modèle Anthropic est l'anglais.",
    "   Si le fichier est rédigé dans une autre langue, TRADUIS toute la prose d'instruction en anglais.",
    "   Exception stricte : conserve à l'identique le code, les identifiants, les chemins, les noms de",
    "   commandes/outils, et tout contenu explicitement destiné à un humain final (exemples de réponse, copy).",
    "5. Applique les autres corrections de l'analyse (structure XML, why, anti sur-prompting, triggers…).",
    "6. Ne rallonge pas inutilement : densité, pas de remplissage.",
    "",
    rubric ? "=== RÉFÉRENCE DE PROMPTING (normes Anthropic, à respecter) ===\n" + rubric + "\n" : "",
    "=== ANALYSE PROFONDE (ce qu'il faut corriger) ===",
    analysis,
    "",
    "=== FICHIER ACTUEL (à corriger) ===",
    content,
    "",
    "Émets le contenu corrigé COMPLET du fichier, encadré EXACTEMENT par ces deux sentinelles,",
    "chacune seule sur sa ligne (tout texte hors des sentinelles sera ignoré) :",
    CORRECTION_START,
    "<ici le fichier corrigé complet, prêt à écrire tel quel>",
    CORRECTION_END,
  ].join("\n");
}
