# Claude Arcade ☤

Dashboard arcade gamifié + boucle d'auto-amélioration pour **Claude Code**. 100% local, zéro API externe.

Inspiré du plugin `hermes-achievements` (@PCinkusz, MIT) de Hermes Agent, transposé sur les données de Claude Code.

Objectif : voir `docs/NORTH-STAR.md`. Faire que Claude Code apprenne session après session — ne pas refaire les erreurs passées, réutiliser les patterns de résolution d'un projet à l'autre, et le prouver par une courbe.

## Les briques

1. **Dashboard arcade** — scanne `~/.claude/projects/**/*.jsonl` et débloque des badges tiered (Copper → Olympian) selon ton activité réelle. **Aucun LLM**, pur scan local.
2. **Consolidation temps réel** — à chaque fin de session, le hook `SessionEnd` lance un `claude -p` isolé (1 passe, abonnement Claude Code) qui résume la session : difficulté, problèmes rencontrés et leur schéma de résolution, principes de travail. Backfill de l'historique en manuel uniquement (onglet Conso).
3. **Apprentissage continu** — le cœur :
   - **Classes canoniques** : le même problème est reconnu d'un projet à l'autre, sans modèle local (le LLM de consolidation l'y range).
   - **Graphiques de résolution** (onglet Résolutions) : le chemin de chaque résolution en visuel, champion contre approches concurrentes.
   - **Courbe d'apprentissage** (onglet Apprentissage) : les classes déjà vues se résolvent-elles mieux ? L'injection aide-t-elle ? Mesuré, pas supposé.
   - **Injection PUSH** : les hooks `SessionStart`/`UserPromptSubmit` remettent le meilleur schéma connu dans le contexte des sessions suivantes.

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
