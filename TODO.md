# TODO — claude-arcade
*Dernière mise à jour : 2026-06-12*

## Vision validée — voir docs/VISION.md (Consolidation & Brain)
Système de consolidation 4 couches + digest PUSH (BRAIN.md injecté via SessionStart) + cron zéro-perte (systemd Persistent). But : courbe d'apprentissage continue.
- [ ] Couche 1 — résumé par session (incrémental) + ossature systemd zéro-perte
- [ ] Couche 2 — consolidation (liens entre discussions, insights, erreurs récurrentes)
- [ ] Couche 3 — digest BRAIN.md + hook SessionStart (PUSH natif)
- [ ] Couche 4 — onglets Arcade : Sessions / Insights / Liens / Brain
- [ ] Garde-fous : anti-récursion (sentinelle env), 1×/jour puis toutes les 15 sessions

## En cours
- [ ] Phase 3 — hook SessionEnd + loop/review (claude -p) + onglet Learnings + merge-draft (sous-ensemble de la vision ci-dessus)

## À faire (priorité)
- [ ] Cache incrémental scanner (fingerprint mtime+size) — rend le rescan temps réel quasi gratuit (actuel : 2,5s/648 sessions, throttlé à 8s)
- [ ] Vue « skills les plus utilisés » (demandé par Chris)
- [ ] Share cards canvas client-side (export PNG 1200×630)

## Backlog
- [ ] Recouper métriques avec claude-usage-stats MCP
- [ ] Liste de skills protégés (boucle)
- [ ] Achievements secrets supplémentaires

## Terminé
- [x] Scaffold projet (config, scripts, docs)
- [x] Phase 1 — scanner (session-reader, tool-classify, metrics, aggregate)
- [x] Phase 1 — engine (catalog 28 achievements, evaluate, score, state)
- [x] Phase 1 — CLI scan + tests (6/6) + validation 648 sessions réelles (rang Diamond, 24/28)
- [x] Phase 2 — serveur Bun.serve (API mémoïsée) + dashboard React/Tailwind/Framer Motion, validé Playwright (zéro erreur console)
