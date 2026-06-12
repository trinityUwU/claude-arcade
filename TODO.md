# TODO — claude-arcade
*Dernière mise à jour : 2026-06-12*

## En cours
- [ ] Phase 3 — hook SessionEnd + loop/review (claude -p) + onglet Learnings + merge-draft

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
