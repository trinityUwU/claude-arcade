// Empreinte de fichier partagée (cache de scan + idempotence de consolidation).
import { stat } from "node:fs/promises";

/** Empreinte d'un fichier (mtime arrondi + taille). null si le fichier a disparu. */
export async function fileFingerprint(file: string): Promise<string | null> {
  try {
    const s = await stat(file);
    return `${Math.round(s.mtimeMs)}:${s.size}`;
  } catch {
    return null;
  }
}

/** Âge du fichier en ms depuis sa dernière modification (Infinity si introuvable). */
export async function fileAgeMs(file: string): Promise<number> {
  try {
    const s = await stat(file);
    return Date.now() - s.mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
