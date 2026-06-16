// Détection déterministe « majoritairement anglais ou non ».
// La norme pour les modèles Anthropic (cible exclusive du projet) est l'anglais :
// un prompt/skill/instruction rédigé dans une autre langue est signalé.

const EN_STOP = new Set([
  "the", "and", "you", "for", "with", "this", "that", "your", "are", "must",
  "when", "should", "not", "from", "use", "will", "can", "have", "into", "any",
]);
const ROMANCE_STOP = new Set([
  "le", "la", "les", "des", "une", "vous", "votre", "être", "avec", "pour",
  "dans", "que", "qui", "pas", "sur", "est", "cette", "aux", "nous", "el",
  "los", "una", "para", "como", "pero", "porque", "também", "você", "não", "são",
]);

/** Retire les blocs de code (```…```) et l'inline code pour ne juger que la prose. */
function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
}

export interface LangVerdict {
  english: boolean;
  enHits: number;
  otherHits: number;
}

/** Compare la fréquence de mots-outils anglais vs romans sur la prose hors-code. */
export function detectEnglish(text: string): LangVerdict {
  const words = stripCode(text).toLowerCase().match(/[a-zàâäéèêëîïôöùûüçñãõ]+/g) ?? [];
  let enHits = 0, otherHits = 0;
  for (const w of words) {
    if (EN_STOP.has(w)) enHits++;
    else if (ROMANCE_STOP.has(w)) otherHits++;
  }
  // Anglais par défaut si trop peu de signal (fichier minuscule ou que du code).
  const english = otherHits < 4 || enHits >= otherHits;
  return { english, enHits, otherHits };
}
