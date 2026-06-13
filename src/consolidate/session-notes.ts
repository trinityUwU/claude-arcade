// Couche Bridge — rattache les notes vivantes d'un cwd à une session par fenêtre temporelle,
// et les rend en section de digest haute fiabilité (notes écrites par Claude pendant le fil).
import { readBucketNotes } from "../notes/store.ts";
import type { SessionNote } from "../notes/types.ts";

const GRACE_MS = 2 * 60_000; // marge de part et d'autre (latence SessionEnd, note de clôture)

/** Notes du cwd tombant dans la fenêtre [startTs, endTs] (avec marge), triées chronologiquement.
 *  endTs=0 (inconnu) → borne haute = maintenant. startTs=0 → aucun rattachement fiable. */
export async function loadNotesForSession(cwd: string, startTs: number, endTs: number): Promise<SessionNote[]> {
  if (!cwd || !startTs) return [];
  const lo = startTs - GRACE_MS;
  const hi = (endTs > 0 ? endTs : Date.now()) + GRACE_MS;
  const all = await readBucketNotes(cwd);
  return all.filter((n) => n.at >= lo && n.at <= hi).sort((a, b) => a.at - b.at);
}

/** Rend les notes en section de digest. Précède les notes comme source haute fiabilité pour le résumé. */
export function renderNotesSection(notes: SessionNote[]): string {
  if (!notes.length) return "";
  const lines = notes.map((n) => {
    const tags = n.tags?.length ? ` (${n.tags.join(", ")})` : "";
    const art = n.artifactPath ? ` [artefact: ${n.artifactPath}]` : "";
    return `- [${n.kind}]${tags} ${n.text}${art}`;
  });
  return [
    "",
    "## NOTES TEMPS RÉEL — haute fiabilité",
    "Notes prises par l'assistant PENDANT la session (décisions, contradictions, stack, patterns).",
    "Sources directes : privilégie-les sur ta reconstruction du fil.",
    ...lines,
  ].join("\n");
}
