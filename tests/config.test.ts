// Tests Vague 5 — scan de la config Claude Code : frontmatter, région managée, whitelist patchable.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanConfig } from "../src/config/scan.ts";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "arcade-cfg-"));
  process.env.ARCADE_CONFIG_ROOT = root;
  await writeFile(join(root, "CLAUDE.md"), "# instructions globales\n");
  await mkdir(join(root, "rules"), { recursive: true });
  await writeFile(join(root, "rules", "code-standards.md"), "limites dures\n");
  await mkdir(join(root, "skills", "humanizer"), { recursive: true });
  await writeFile(
    join(root, "skills", "humanizer", "SKILL.md"),
    "---\nname: humanizer\ndescription: enlève les marqueurs IA\n---\ncorps du skill\n<!-- arcade:managed -->\nzone\n",
  );
  await mkdir(join(root, "commands"), { recursive: true });
  await writeFile(join(root, "commands", "lint.md"), "lint\n");
  await writeFile(join(root, "settings.json"), "{}\n");
});

afterAll(async () => {
  delete process.env.ARCADE_CONFIG_ROOT;
  await rm(root, { recursive: true, force: true });
});

test("scanConfig : classe chaque fichier par kind", async () => {
  const tree = await scanConfig();
  const byRel = new Map(tree.entries.map((e) => [e.relPath, e]));
  expect(byRel.get("CLAUDE.md")?.kind).toBe("instruction");
  expect(byRel.get("rules/code-standards.md")?.kind).toBe("instruction");
  expect(byRel.get("skills/humanizer/SKILL.md")?.kind).toBe("skill");
  expect(byRel.get("commands/lint.md")?.kind).toBe("command");
  expect(byRel.get("settings.json")?.kind).toBe("setting");
});

test("scanConfig : parse le frontmatter name/description du skill", async () => {
  const skill = (await scanConfig()).entries.find((e) => e.relPath === "skills/humanizer/SKILL.md");
  expect(skill?.name).toBe("humanizer");
  expect(skill?.description).toBe("enlève les marqueurs IA");
});

test("scanConfig : détecte la région managée", async () => {
  const skill = (await scanConfig()).entries.find((e) => e.relPath === "skills/humanizer/SKILL.md");
  expect(skill?.managed).toBe(true);
  const claude = (await scanConfig()).entries.find((e) => e.relPath === "CLAUDE.md");
  expect(claude?.managed).toBe(false);
});

test("scanConfig : CLAUDE.md et settings hors whitelist patchable, skill/rule patchables", async () => {
  const e = new Map((await scanConfig()).entries.map((x) => [x.relPath, x]));
  expect(e.get("CLAUDE.md")?.patchable).toBe(false);
  expect(e.get("settings.json")?.patchable).toBe(false);
  expect(e.get("skills/humanizer/SKILL.md")?.patchable).toBe(true);
  expect(e.get("rules/code-standards.md")?.patchable).toBe(true);
});

test("scanConfig : non versionné sur un dossier sans git", async () => {
  expect((await scanConfig()).versioned).toBe(false);
});
