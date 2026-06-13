// Couche Bridge — notes vivantes prises par Claude PENDANT une session (haute fiabilité).
// Écrites en temps réel via le CLI `arcade-note`, rattachées à la consolidation par cwd + fenêtre temps.

export type NoteKind =
  | "decision"       // décision technique prise dans le fil
  | "contradiction"  // tension/contradiction relevée
  | "stack"          // notation de stack/outil/version
  | "pattern"        // façon de faire dégagée (alimente la couche B)
  | "summary"        // résumé intermédiaire d'un segment de discussion
  | "artifact"       // production concrète (fichier HTML, snippet) attachée
  | "note";          // note libre par défaut

export const NOTE_KINDS: readonly NoteKind[] = [
  "decision", "contradiction", "stack", "pattern", "summary", "artifact", "note",
] as const;

export function isNoteKind(v: string): v is NoteKind {
  return (NOTE_KINDS as readonly string[]).includes(v);
}

/** Une note vivante persistée (une ligne JSONL dans le bucket du cwd). */
export interface SessionNote {
  at: number;               // epoch ms de la prise de note
  kind: NoteKind;
  text: string;
  tags?: string[];
  artifactPath?: string;    // chemin absolu réel de l'artefact (ouvrable/éditable en place)
  archivedPath?: string;    // copie durable dans le bucket (survit à la suppression de l'original)
}
