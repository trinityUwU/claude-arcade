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

## Prochaines étapes
1. Phase 3 : hook SessionEnd + loop/review (claude -p) + onglet Learnings + merge-draft (propose-et-valide)
2. Share cards canvas client-side · bouton Rescan UI · cache incrémental scanner

## Points en suspens
- Recouper avec le MCP existant `claude-usage-stats` (option, pas bloquant).
