// Tests Vague 5 inc.3c — application réelle (archive token-free + patch/create via générateur mocké).
// Tout dans une config temp + git temp : ne touche JAMAIS la vraie config, ne dépense aucun token.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyProposal } from "../src/config/apply.ts";
import { generatePatch } from "../src/config/evolve.ts";
import type { Proposal } from "../src/config/types.ts";
import type { Generator } from "../src/config/evolve.ts";

let root: string;
let state: string;

async function git(args: string[]): Promise<void> {
  await Bun.spawn(["git", ...args], { cwd: root, stdout: "ignore", stderr: "ignore" }).exited;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "arcade-apply-"));
  state = await mkdtemp(join(tmpdir(), "arcade-apply-state-"));
  process.env.ARCADE_CONFIG_ROOT = root;
  process.env.ARCADE_STATE_DIR = state;
  await mkdir(join(root, "skills", "dead"), { recursive: true });
  await writeFile(join(root, "skills", "dead", "SKILL.md"), "---\nname: dead\n---\nskill mort\n");
  await mkdir(join(root, "skills", "foo"), { recursive: true });
  await writeFile(join(root, "skills", "foo", "SKILL.md"), "---\nname: foo\ndescription: un skill existant assez long pour les marges\n---\ncorps original du skill foo avec plusieurs lignes de contenu\n");
  await git(["init"]); await git(["config", "user.email", "t@t"]); await git(["config", "user.name", "t"]);
  await git(["add", "-A"]); await git(["commit", "-m", "base"]);
});

afterAll(async () => {
  delete process.env.ARCADE_CONFIG_ROOT;
  delete process.env.ARCADE_STATE_DIR;
  await rm(root, { recursive: true, force: true });
  await rm(state, { recursive: true, force: true });
});

const gen = (content: string): Generator => () => Promise.resolve(JSON.stringify({ content }));

test("archive : déplace le skill vers .archived + commit, sans LLM", async () => {
  const p: Proposal = { id: "archive:dead", kind: "archive", title: "Archiver dead", rationale: "0 invoc", sourceKey: "dead", targetRel: "skills/dead/SKILL.md", status: "pending", createdAt: 0 };
  const out = await applyProposal(p);
  expect(out.status).toBe("applied");
  expect(out.commitHash).toBeTruthy();
  expect(await Bun.file(join(root, "skills/.archived/dead/SKILL.md")).exists()).toBe(true);
  expect(await Bun.file(join(root, "skills/dead/SKILL.md")).exists()).toBe(false);
});

test("patch : réécrit le skill via générateur, commit", async () => {
  const p: Proposal = { id: "patch:d", kind: "patch", title: "Évoluer foo", rationale: "ancrer un principe", sourceKey: "d", targetRel: "skills/foo/SKILL.md", status: "pending", createdAt: 0 };
  const out = await applyProposal(p, gen("---\nname: foo\n---\ncorps réécrit court\n"));
  expect(out.status).toBe("applied");
  expect(await Bun.file(join(root, "skills/foo/SKILL.md")).text()).toContain("corps réécrit court");
});

test("create : crée un nouveau SKILL.md depuis un gap", async () => {
  const p: Proposal = { id: "create:newclass", kind: "create", title: "Créer un skill : new class", rationale: "définition de la classe", sourceKey: "newclass", status: "pending", createdAt: 0 };
  const out = await applyProposal(p, gen("---\nname: new-class\ndescription: x\n---\nprocédure\n"));
  expect(out.status).toBe("applied");
  expect(out.targetRel).toBe("skills/newclass/SKILL.md");
  expect(await Bun.file(join(root, "skills/newclass/SKILL.md")).exists()).toBe(true);
});

test("anti-bloat : un patch trop long est rejeté, le fichier reste intact", async () => {
  const before = await Bun.file(join(root, "skills/foo/SKILL.md")).text();
  const res = await generatePatch("foo", before, "principe", gen("x".repeat(before.length * 3)));
  expect("skip" in res).toBe(true);
});
