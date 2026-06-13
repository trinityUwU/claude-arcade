#!/usr/bin/env bun
// CLI canal d'écriture des notes vivantes. Appelé par Claude via Bash PENDANT une session.
// Le cwd courant détermine le bucket → rattaché ensuite à la session par fenêtre temporelle.
// Usage : arcade-note <kind> <texte…> [--artifact <chemin>] [--tag <t>]…
import { resolve } from "node:path";
import { isNoteKind, NOTE_KINDS, type NoteKind, type SessionNote } from "./types.ts";
import { appendNote, archiveArtifact } from "./store.ts";
import { logger } from "../logger.ts";

interface ParsedArgs {
  kind: string;
  text: string;
  artifact?: string;
  tags: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const tags: string[] = [];
  let artifact: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--artifact") { artifact = argv[++i]; }
    else if (a === "--tag") { const t = argv[++i]; if (t) tags.push(t); }
    else positional.push(a);
  }
  return { kind: positional[0] ?? "", text: positional.slice(1).join(" ").trim(), artifact, tags };
}

function usage(): never {
  process.stderr.write("arcade-note <kind> <texte> [--artifact <chemin>] [--tag <t>]\n");
  process.stderr.write(`  kinds: ${NOTE_KINDS.join(", ")}\n`);
  process.exit(2);
}

async function buildNote(p: ParsedArgs, kind: NoteKind): Promise<SessionNote> {
  const note: SessionNote = { at: Date.now(), kind, text: p.text };
  if (p.tags.length) note.tags = p.tags;
  if (p.artifact) {
    note.artifactPath = resolve(p.artifact);
    const archived = await archiveArtifact(process.cwd(), note.artifactPath);
    if (archived) note.archivedPath = archived;
  }
  return note;
}

async function main(): Promise<void> {
  const p = parseArgs(process.argv.slice(2));
  if (!p.kind || !isNoteKind(p.kind) || !p.text) usage();
  try {
    const note = await buildNote(p, p.kind as NoteKind); // narrowed par isNoteKind ci-dessus
    await appendNote(process.cwd(), note);
    process.stdout.write(`✓ note [${note.kind}] enregistrée\n`);
  } catch (err) {
    logger.error({ err }, "arcade-note failed");
    process.stderr.write(`✗ échec d'écriture de la note\n`);
    process.exit(1);
  }
}

void main();
