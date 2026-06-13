# STATE — claude-arcade
*Dernière mise à jour : 2026-06-13*

## Session 2026-06-13 (suite) — COUCHE 3 : évolution darwinienne des schémas de résolution (LIVRÉE)
Système qui apprend de ses propres sessions : extrait par session le sujet, la difficulté (+pourquoi) et la LISTE EXHAUSTIVE des problèmes, chacun avec son schéma de résolution. Regroupe par catégorie, élit un **champion** par **fitness composite auto**, conserve la lignée, mesure l'évolution dans le temps, et **injecte** le champion pertinent dans le contexte (hooks). Tout visible dans l'app. 5 Epics A→E, 20 stories, 45/45 tests, tsc 0, validé E2E Playwright. Rapport : `logs/report-2026-06-13_07-42.md`.
- **A — data v2** : `SummaryFields` + `difficulty{level,why}` + `problems[]` (resolution_schema {steps, tools_used, turns_to_resolve, backtracks, tool_errors, outcome}). SCHEMA_VERSION 1→2. Budget digest 9000→16000. Rétro-compat v1 (defaults au narrowing + guards `?? []`/`?.` dans champions.ts/evolution.ts).
- **B — champions** : `fitness.ts` (computeFitness = 0.35·(1/turns)+0.25·(1/(bt+1))+0.20·(1/(te+1))+0.20·(q/100) ×{resolved 1,partial .6,unresolved 0}, + fitnessBreakdown/FITNESS_WEIGHTS), `champions.ts` (buildChampions : regroupement par groupingKey(category), élection, contenders triés, history/lignée chronologique). Persisté `champions.json`. Endpoints /api/champions(/:category), /api/problems.
- **C — évolution** : `evolution.ts` (buckets hebdo ISO : recurrence_rate, avgChampionFitness, difficulty, tendances). Métrique maîtresse = réapparition ↓ + fitness ↑. `evolution.json`, /api/evolution.
- **D — PUSH** : `champion-context.ts` (rendu injectable borné), `classifier.ts` (texte→catégorie par recouvrement tokens), hooks `src/hooks/{session-start,user-prompt-submit}.ts` (fail-safe total, anti-récursion ARCADE_LOOP_ACTIVE=1), trace `injections.json` + /api/injections. **install-hooks.sh GATÉ — non exécuté, settings.json inchangé**.
- **E — app** : nav verticale 2 groupes (Arcade/Apprentissage), 5 onglets Sessions/Problèmes/Schémas/Évolution/Injection. Schémas = breakdown fitness en 4 barres + multiplicateur + total. Validé E2E (0 erreur console/backend).
- **2 portes gatées (go Chris)** : (1) `bash src/hooks/install-hooks.sh` = active injection sur TOUTES les sessions Claude Code ; (2) backfill ~557 sessions en v2 = densifie champions/évolution (comparaisons et tendances s'activent à 2+ occurrences/buckets).

## Session 2026-06-13 — rattrapage + consolidation manuelle
- **Constat** : les consolidations auto N'AVAIENT JAMAIS tourné (timer systemd jamais installé/activé). Seuls 19 résumés existaient (batch de test du 12/06 15h24).
- **Rattrapage lancé** (quota 80, ratio 25/j neutralisé) : 21 résumées + 59 sautées (sessions vides/triviales), 0 échec. Sessions d'hier capturées (hermes 15h42 → q80, ccremote vague 2-5 → q85). 40 résumés au total, reste ~559 en attente.
- **Feature livrée — consolidation manuelle depuis l'app** (onglet « Conso ») : compteur en attente, presets 25/50/100 + champ libre + « Tout (N) », progression live, bouton Arrêter. Backend : `countPending`, `runConsolidation({quota,onProgress,shouldStop})`, job singleton (`src/consolidate/job.ts`), endpoints `/api/consolidate`, `/api/consolidate/status`, `/api/consolidate/stop`. Validé : typecheck 0, Playwright zéro erreur console, flux run→progress→done E2E OK.
- **systemd auto ACTIVÉ sans rattrapage** : timer quotidien `Persistent=true` enabled (prochain run 14/06 00:03, rattrape au réveil). Mode auto (`ARCADE_AUTO=1`) = WATERMARK posé à maintenant (`auto-watermark.json`) → ne consolide que les sessions postérieures. Le backlog (557) reste accessible au déclenchement MANUEL via l'app. Deux portées distinctes. `selectPending(files, idx, sinceMs?)`, `loadWatermark/saveWatermark` dans store.ts, CLI `ARCADE_AUTO=1` pose la baseline au 1er run puis filtre. Note env : `systemctl --user` exige `XDG_RUNTIME_DIR=/run/user/1000` dans un shell non-interactif.
- L'auto est le cœur du projet (PUSH continu) ; le manuel ne sert qu'au rattrapage ponctuel — les deux sont nécessaires.

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
- **Graphe Cerveau interactif** : labels permanents + glyphes de type + panneau de types (lisibilité), clic nœud → panneau détail (résumé + transcript nettoyé). Endpoints `/api/session/:id` `/api/transcript/:id`. Reste : filtres, co-occurrence notions, recherche.

## Prochaines étapes
1. Chris : activer le backfill systemd (647 sessions, quota 25/j) quand il valide le coût
2. Couche 2 consolidation (liens, insights, erreurs récurrentes) · Couche 3 digest BRAIN.md + hook SessionStart · Couche 4 onglets Arcade
3. LISTE 1 — Graphe écosystème Obsidian 2D (dépend des liens Couche 2)
4. LISTE 2 reste : vue « skills les plus utilisés », share cards

## Points en suspens
- Recouper avec le MCP existant `claude-usage-stats` (option, pas bloquant).
