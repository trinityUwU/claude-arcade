#!/usr/bin/env bash
# install-hooks.sh — installe les hooks claude-arcade dans ~/.claude/settings.json.
#
# ATTENTION : ceci modifie le comportement de TOUTES tes sessions Claude Code.
# Les hooks injectent du contexte (schémas de résolution "champions") au démarrage de
# session et à chaque prompt soumis. Cela ajoute un léger coût en tokens à chaque session.
# À n'activer qu'en connaissance de cause. Lancement MANUEL uniquement.
#
# Idempotent : relançable sans dupliquer. Backup .bak créé avant toute écriture.
set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"
ROOT="/mnt/projects/claude-arcade/src/hooks"
export SS_CMD="bun run $ROOT/session-start.ts"
export UP_CMD="bun run $ROOT/user-prompt-submit.ts"
export SE_CMD="bun run $ROOT/session-end.ts"

bun -e '
const path = process.env.HOME + "/.claude/settings.json";
const ssCmd = process.env.SS_CMD;
const upCmd = process.env.UP_CMD;
const seCmd = process.env.SE_CMD;

async function main() {
  const f = Bun.file(path);
  const settings = (await f.exists()) ? await f.json() : {};
  if (await f.exists()) await Bun.write(path + ".bak", await f.text());

  settings.hooks ??= {};
  const ensure = (event, cmd) => {
    settings.hooks[event] ??= [];
    const matchers = settings.hooks[event];
    const has = matchers.some((m) =>
      Array.isArray(m.hooks) && m.hooks.some((h) => h.command === cmd));
    if (has) return false;
    matchers.push({ hooks: [{ type: "command", command: cmd }] });
    return true;
  };

  const a = ensure("SessionStart", ssCmd);
  const b = ensure("UserPromptSubmit", upCmd);
  const c = ensure("SessionEnd", seCmd);
  if (a || b || c) {
    await Bun.write(path, JSON.stringify(settings, null, 2));
    console.log("Hooks installes (SessionStart:" + (a ? "ajoute" : "deja la") +
      ", UserPromptSubmit:" + (b ? "ajoute" : "deja la") +
      ", SessionEnd:" + (c ? "ajoute" : "deja la") + ").");
  } else {
    console.log("Hooks deja presents — rien a faire.");
  }
}
main();
'

cat <<EOF

Backup : $SETTINGS.bak
Pour desinstaller : edite $SETTINGS et retire les entrees dont la commande
contient "$ROOT" sous hooks.SessionStart, hooks.UserPromptSubmit et
hooks.SessionEnd, ou restaure le backup : cp "$SETTINGS.bak" "$SETTINGS"
EOF
