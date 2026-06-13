# TODO — claude-arcade
*Dernière mise à jour : 2026-06-13*

> Référence directrice : `docs/NORTH-STAR.md` (immuable). Ce plan ne sert QUE le North Star : courbe d'apprentissage réelle, prouvée, temps réel, zéro modèle local, backfill manuel only.

## ════ PLAN MAGISTRAL — 4 PHASES ════

### PHASE 1 — Matching canonique des problèmes (fondation) — LIVRÉ
Reconnaître le « même problème » entre sessions/projets sans modèle local. Le `claude -p` de consolidation (déjà gratuit, 1×/session) range chaque problème dans une taxonomie canonique évolutive. Remplace le classifier token-overlap.
- [x] Registre de classes canoniques persistant (`canonical-classes.json`) : id, nom, définition, occurrences.
- [x] Prompt de consolidation v4 enrichi : index borné injecté → le LLM assigne classe existante OU nouvelle.
- [x] Schéma data : `canonicalClassId` sur chaque `Problem` + rétro-compat (fallback groupingKey).
- [x] Champions/évolution regroupent par classe canonique (`problemKey`). Labels = noms canoniques.
- [x] `/api/canonical` ; classifier matche sur vocabulaire canonique. 8 tests, E2E réel OK.

### PHASE 2 — Graphiques de résolution (couche visuelle) — LIVRÉ
Demande explicite Chris : pour chaque problème, le schéma VISUEL de sa résolution, pas que du texte. Texte gardé, visuel ajouté.
- [x] Schéma par résolution (`ResolutionFlow.tsx`) : timeline verticale étape→issue, outils, retours/erreurs.
- [x] Vue par classe canonique (`ResolutionsPanel.tsx`) : champion + définition + concurrents côte à côte.
- [x] Onglet « Résolutions » dédié (nav Apprentissage, GitBranch). Design cohérent dark/sobre.
- [x] tsc 0 + E2E Playwright (assert texte, 0 erreur console). [ ] évolution temporelle du schéma → reportée Phase 3.

### PHASE 3 — Boucle de feedback + courbe d'apprentissage (le cœur) — LIVRÉ
Prouver que ça apprend. Tracer injection→session→delta, mesurer, afficher la courbe.
- [x] Attribution injection→rencontre (`learning.ts`) par cwd + fenêtre temporelle + label de classe.
- [x] Mesure du delta : trajectoire par classe (fitness/tours dans le temps) + `injectionLift` causal (injecté − non injecté).
- [x] Métriques de courbe : récurrence (déjà evolution), Δ fitness/tours par classe, classes improving/worsening.
- [x] Écran « Apprentissage » en tête du groupe (KPI causaux + sparkline par classe). `learning.json`, `/api/learning`.
- [x] 6 tests learning (89 total) + tsc 0 + E2E réel (2 classes récurrentes, 0 erreur console).

### PHASE 4 — Fitness ancrée sur les résultats — LIVRÉ
Arrêter de récompenser la facilité. Un champion vaut par sa qualité de résolution RELATIVE à la difficulté.
- [x] Redéfinir fitness : effort (tours/retours) normalisé par budget de sévérité (`SEVERITY_BUDGET`). Major dans son enveloppe = plein score.
- [x] Élection recalibrée : `champions.ts`/`learning.ts` passent `p.severity`. `SchemasPanel` reflète (labels budget).
- [x] Durabilité « a tenu dans les sessions suivantes » = mesurée par la courbe Phase 3 (trend), pas réinjectée (zéro boucle champions↔learning).
- [x] 3 tests fitness severity-aware (91 total) + tsc 0 + E2E réel (0 erreur console).
- [ ] Extension future (hors scope) : prioriser l'INJECTION par signal de courbe (lift/besoin de classe) sans toucher l'élection.

## Garde-fous permanents (North Star)
- Temps réel : SessionEnd consolide immédiatement (1 passe). Backfill = manuel only via l'app.
- Zéro modèle local, zéro API externe. Tout via abonnement Claude Code.
- Jamais de batch auto qui crame des tokens.
- Propose-et-valide pour tout patch de skill ciselé main.

## ════ TERMINÉ (existant — la plomberie ~70%) ════
- [x] Phase 1 scanner + engine (28 achievements, rang Diamond sur 648 sessions) + CLI
- [x] Phase 2 serveur Bun.serve:4317 + dashboard React/Tailwind/Framer (dark)
- [x] Couche 1 résumé par session (`claude -p` isolé sonnet cloud, JSON, idempotent, store zéro-perte)
- [x] Couche 2 consolidation : insights, erreurs récurrentes, process gagnants, graphe écosystème
- [x] Couche 3 darwinisme : champions par fitness composite + évolution hebdo + PUSH via hooks
- [x] Couche (B) principes : compétition déterministe + LLM-judge pour/contre + puissance
- [x] Bridge notes vivantes (`arcade-note`, rattachement cwd+fenêtre, artefacts ouvrables)
- [x] Hook SessionEnd (consolidation temps réel, worker détaché, idempotent) + systemd Persistent filet
- [x] Graphe Obsidian 2D (react-force-graph-2d) + clic→détail+transcript
- [x] Vue skills les plus utilisés + bug Live résolu (cache incrémental)
- [x] Consolidation manuelle depuis l'app (onglet Conso, presets, progression live)
