# Claude Arcade ☤

Dashboard arcade gamifié + boucle d'auto-amélioration pour **Claude Code**. 100% local, zéro API externe.

Inspiré du plugin `hermes-achievements` (@PCinkusz, MIT) de Hermes Agent, transposé sur les données de Claude Code.

## Deux briques

1. **Dashboard arcade** — scanne `~/.claude/projects/**/*.jsonl` (ton historique de sessions) et débloque des badges tiered (Copper → Silver → Gold → Diamond → Olympian) selon ton activité réelle : autonomie, debugging, vibe coding, usage skills/mémoire, recherche, modèles, lifestyle. **Aucun LLM** — pur scan local.
2. **Boucle d'auto-amélioration** — hook `SessionEnd` qui lance `claude -p` pour relire la session finie et proposer des améliorations de skills (en draft à valider) + écrire la mémoire sémantique. **Claude Code uniquement**, rien d'externe.

## Lancement

```bash
bun install
bun run scan        # scan CLI : imprime achievements + score depuis tes vraies sessions
./start.sh          # dashboard → http://localhost:4317
./stop.sh
```

## Stack

Bun + TypeScript · React + Tailwind + Framer Motion (dark) · `Bun.serve()` port 4317 · état local `~/.claude/claude-arcade/state.json`.

## Ports

| Service | Port |
|---|---|
| Dashboard | 4317 |
