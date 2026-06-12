// Normalisation de texte pour regrouper erreurs/process quasi-identiques (récurrence).
// Déterministe, testable. Pas de LLM.

const STOPWORDS = new Set([
  "avec", "dans", "pour", "plus", "sans", "sous", "leur", "leurs", "cette", "cette",
  "elle", "elles", "nous", "vous", "être", "fait", "faire", "tout", "tous", "toute",
  "comme", "mais", "donc", "alors", "puis", "aussi", "très", "trop", "bien", "déjà",
  "session", "agent", "chris", "claude", "code", "été", "avoir", "cela", "celui",
]);

/** Retire accents + casse, ne garde que lettres/chiffres/espaces. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clé de regroupement : tokens significatifs (≥4 lettres, hors stopwords), triés, top 5. */
export function groupingKey(s: string): string {
  const tokens = normalizeText(s)
    .split(" ")
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set(tokens)].sort().slice(0, 5).join(" ");
}

/** Normalise un mot-clé de notion (links_hint) : casse/accents seulement, garde l'unité. */
export function notionKey(s: string): string {
  return normalizeText(s);
}
