# STATE — claude-arcade
*Dernière mise à jour : 2026-06-12*

## Résumé de l'état actuel
Projet neuf. Phase 1 (moteur de scan + CLI) en cours. Objectif : reproduire en local, Claude-Code-only, le dashboard arcade de hermes-achievements + une boucle d'auto-amélioration via hook SessionEnd.

## Ce qui a été fait — session du 2026-06-12
- Scaffold : package.json (Bun/TS), tsconfig strict, scripts start/stop/restart, docs norme, .echoforge.yml
- **Phase 1 COMPLÈTE** : scanner (session-reader/tool-classify/metrics/aggregate) + engine (catalog 28 achievements, evaluate, score, state) + CLI
- Validé sur 648 sessions réelles en 2,2s : rang Diamond, 5115 pts, 24/28 débloqués. Tests 6/6 verts, typecheck clean.

## Décisions prises
| Décision | Raison | Date |
|---|---|---|
| Bun/TS au lieu du Python de Hermes | Stack par défaut de Chris | 2026-06-12 |
| Trigger boucle = hook SessionEnd | Validé (vs cron) — quasi temps réel, invisible | 2026-06-12 |
| Autonomie = propose-et-valide | Protéger les skills ciselés à la main de la dérive | 2026-06-12 |
| Zéro API externe, dashboard sans LLM | Contrainte souveraineté de Chris | 2026-06-12 |

## Contexte non-évident
- Source données = `~/.claude/projects/<cwd>/<uuid>.jsonl`. tool_use dans `message.content[]` des lignes `assistant`. Erreurs dans tool_result (`is_error`) des lignes `user`.
- Moteur porté depuis `/mnt/projects/hermes-agent/plugins/hermes-achievements/dashboard/plugin_api.py`.
- Plan complet : `~/.claude/plans/mellow-squishing-crown.md`.

## Phase 2 — COMPLÈTE (2026-06-12)
- src/server/api.ts : Bun.serve port 4317, scan mémoïsé, routes /api/achievements /api/recent /api/rescan
- web/ : dashboard React/Tailwind v4/Framer Motion, dark theme, badges tiered, filtre catégories
- Bundling Bun (bunfig.toml + bun-plugin-tailwind). Validé Playwright : rendu conforme, zéro erreur console/page.
- Lancement : `./start.sh` → http://localhost:4317

## VISION VALIDÉE (2026-06-12) — docs/VISION.md
Claude Arcade évolue en système de Consolidation & Brain : 4 couches (résumés par session → consolidation → digest BRAIN.md PUSH via SessionStart → hub Arcade), cron zéro-perte (systemd Persistent=true, rattrapage au boot, incrémental). Insight central : PUSH (digest injecté natif) au-dessus de la mémoire sémantique PULL. But : courbe d'apprentissage continue, qualité d'exécution croissante.

## Session 2026-06-12 (suite) — bug Live + Couche 1
- **Bug Live RÉSOLU** : cache incrémental (`scanner/cache.ts`, fingerprint mtime+size) → rescan 3,24s→0,14s ; heartbeat SSE /15s ; UI debounce 5s. Validé Playwright (22s, 0 flicker).
- **Couche 1 LIVRÉE & VALIDÉE** : transcript→digest borné → `claude -p` isolé (sonnet, abonnement cloud) → JSON structuré → store idempotent + quota backfill + ossature systemd `Persistent=true`. Testé sur sessions réelles (résumé qualité 85, idempotence confirmée, sessions triviales scorées 0).
- **CORRECTION Chris** : AUCUN modèle local pour ce projet. « zéro API externe » = pas de tiers, PAS « préférer local ». Tout passe par l'abonnement Claude Code (sonnet/opus cloud). Cf. @self ai_error.
- **À activer par Chris** (dépense tokens) : `bash systemd/install.sh` → enable timer.

## Prochaines étapes
1. Chris : activer le backfill systemd (647 sessions, quota 25/j) quand il valide le coût
2. Couche 2 consolidation (liens, insights, erreurs récurrentes) · Couche 3 digest BRAIN.md + hook SessionStart · Couche 4 onglets Arcade
3. LISTE 1 — Graphe écosystème Obsidian 2D (dépend des liens Couche 2)
4. LISTE 2 reste : vue « skills les plus utilisés », share cards

## Points en suspens
- Recouper avec le MCP existant `claude-usage-stats` (option, pas bloquant).
