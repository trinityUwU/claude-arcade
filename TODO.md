# TODO — claude-arcade
*Dernière mise à jour : 2026-06-12*

## Vision validée — voir docs/VISION.md (Consolidation & Brain)
Système de consolidation 4 couches + digest PUSH (BRAIN.md injecté via SessionStart) + cron zéro-perte (systemd Persistent). But : courbe d'apprentissage continue.
- [x] **Couche 1 — résumé par session + ossature systemd zéro-perte** (livré, validé sur abonnement)
  - [x] Réducteur transcript→digest compact borné (`transcript-digest.ts`, ~2,3k tok)
  - [x] Prompt de résumé (TIDD-EC via /prompt-architect) → JSON stable (`summary-prompt.ts`)
  - [x] Pipeline `claude -p` isolé (zéro MCP, no-session-persistence, plan, modèle `sonnet` cloud) + parseur robuste testé
  - [x] Store + index idempotent zéro-perte/zéro-doublon (`store.ts`, last-consolidation.json) + quota backfill (`run.ts`)
  - [x] Unités systemd `Persistent=true` + install.sh (NON activé — go de Chris requis : dépense tokens)
  - [ ] **À activer par Chris** : `bash systemd/install.sh` puis enable timer (backfill 647 sessions, quota 25/j)
- [x] **Couche 2 — consolidation (liens + insights + graphe)** (livré, validé sur 19 sessions réelles)
  - [x] Normalisation texte + détection récurrence (`text-normalize.ts`) erreurs/process count≥2
  - [x] Insights : bilans projet (avgQuality), erreurs récurrentes Claude/Chris, process gagnants, notions (`insights.ts`)
  - [x] Graphe écosystème : nœuds (session/projet/notion/erreur/process) + arêtes + sémantique santé (`graph.ts`)
  - [x] Rebuild auto dans l'orchestrateur + endpoints `/api/insights` `/api/graph` `/api/sessions`
- [ ] Couche 3 — digest BRAIN.md + hook SessionStart (PUSH natif)
- [ ] Couche 4 — onglets Arcade : Sessions / Insights / Liens / Brain
- [x] Garde-fou anti-récursion (sentinelle `ARCADE_LOOP_ACTIVE=1` + no-session-persistence) · [ ] cadence 1×/j puis /15 sessions

## En cours
- [ ] Phase 3 — hook SessionEnd + loop/review (claude -p) + onglet Learnings + merge-draft (sous-ensemble de la vision ci-dessus)

## ════ LISTE 1 — Graphe écosystème (type Obsidian, 2D) — LIVRÉ ════
Réseau 2D plat façon Obsidian, reliant sessions/projets/notions/erreurs/process. Rendu validé Playwright.
- [x] Stack : `react-force-graph-2d` (canvas, force-directed, look Obsidian). Bundlé local, souverain. Pas de Three.js.
- [x] Modèle de données : nœuds {session, projet, notion, erreur-récurrente, process-gagnant} + arêtes (Couche 2). Cf. `graph.ts`.
- [x] Sémantique couleur : vert=fort · rouge=faible/à retravailler · jaune=à surveiller · neutre. Taille = fréquence (`BrainGraph.tsx`).
- [x] Interactions : zoom/pan, hover (tooltip détails), labels au zoom, légende. Switch Arcade/Cerveau dans la sidebar.
- [ ] À enrichir : drill-down clic (ouvrir session/projet), filtres par projet/type/qualité, arêtes notion↔notion (co-occurrence)
- [ ] Se densifie avec le backfill complet (actuellement 19 sessions → 34 nœuds)

## ════ LISTE 2 — Stabilité & bug « Live » ════
- [x] **BUG : badge Live clignote** — RÉSOLU. Cause confirmée : rescan bloquant (parse sync de 648 transcripts ~2,5s, relancé /8s) → flux SSE starvé → onerror navigateur. Triple fix livré + validé Playwright (22s, 44/44 « Live », 0 transition, 0 page-error) :
  - [x] Cache incrémental scanner (`src/scanner/cache.ts`, fingerprint mtime+size, persistance disque) → scan froid 3,24s / chaud 0,14s. Fix racine.
  - [x] Heartbeat SSE : commentaire `: keepalive\n\n` toutes les 15s (api.ts).
  - [x] UI tolérante : debounce 5s avant « Hors ligne » (App.tsx) — EventSource reconnecte seul.
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
