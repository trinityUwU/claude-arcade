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

## ════ LISTE 1 — Graphe écosystème (type Obsidian, 2D) ════
Vision Chris : PAS de 3D/Three.js. Un graphe 2D plat, façon vue graphe d'Obsidian — réseau de
« neurones » omniprésent et interconnecté reliant TOUT : notions issues des analyses de conversations,
types de projets, sessions, erreurs récurrentes, process gagnants, skills. Écosystème complet relié
dans tous les sens pour comprendre d'un coup d'œil : on avance où ? points forts / points faibles ?
quoi retravailler ? où aucun problème ? où faire attention ?
- [ ] Stack reco (à valider) : `react-force-graph-2d` (canvas, force-directed, look Obsidian) ou d3-force + canvas. Souverain, local. Pas Three.js.
- [ ] Modèle de données du graphe : nœuds = {session, projet, notion/sujet, erreur-récurrente, process-gagnant, skill} ; arêtes = liens détectés par la Couche 2 (consolidation).
- [ ] Sémantique couleur : vert = point fort / sain · rouge-orange = point faible / à retravailler · jaune = à surveiller · neutre = sans problème. Taille de nœud = importance/fréquence.
- [ ] Interactions : zoom/pan, hover (détails), clic (drill-down session/projet), filtres par projet/type/qualité, clusters.
- [ ] C'est la version riche de l'onglet « Liens » de la Couche 4 (cf. docs/VISION.md) — le hub central de compréhension.

## ════ LISTE 2 — Stabilité & bug « Live » ════
- [ ] **BUG : badge Live clignote** (Hors ligne ↔ Live toutes les quelques sec, 10-30s+). Cause probable : le rescan bloque l'event loop (parse JSON sync de 648 transcripts ~2,5s, relancé toutes les 8s) → le flux SSE est starvé → onerror navigateur. Triple fix :
  - [ ] Cache incrémental scanner (fingerprint mtime+size) → rescan quasi instantané (ne re-parse que les fichiers changés). Fix racine.
  - [ ] Heartbeat SSE : envoyer `: ping\n\n` toutes les ~15s pour garder la connexion vivante.
  - [ ] UI tolérante : ne pas passer « Hors ligne » sur une coupure transitoire (EventSource reconnecte seul) — debounce ~5s avant d'afficher hors ligne.
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
