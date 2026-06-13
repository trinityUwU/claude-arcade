# TODO — claude-arcade
*Dernière mise à jour : 2026-06-13*

> Référence directrice : `docs/NORTH-STAR.md` (immuable). Ce plan ne sert QUE le North Star : courbe d'apprentissage réelle, prouvée, temps réel, zéro modèle local, backfill manuel only.

## ════ PLAN MAGISTRAL — 4 PHASES ════

### PHASE 1 — Matching canonique des problèmes (fondation)
Reconnaître le « même problème » entre sessions/projets sans modèle local. Le `claude -p` de consolidation (déjà gratuit, 1×/session) range chaque problème dans une taxonomie canonique évolutive. Remplace le classifier token-overlap.
- [ ] Registre de classes canoniques persistant (`canonical-classes.json`) : id, nom, définition courte, signature.
- [ ] Prompt de consolidation enrichi : injecter l'index borné des classes existantes → le LLM assigne chaque problème à une classe existante OU en propose une nouvelle.
- [ ] Schéma data : `canonicalClassId` sur chaque `Problem`. SCHEMA_VERSION bump + rétro-compat.
- [ ] Champions/évolution regroupent par classe canonique (plus par token-overlap).
- [ ] Injection (hooks) = lookup déterministe par classe canonique + projet. Zéro token runtime.
- [ ] Tests + tsc 0 + E2E réel.

### PHASE 2 — Graphiques de résolution (couche visuelle)
Demande explicite Chris : pour chaque problème, le schéma VISUEL de sa résolution, pas que du texte. Texte gardé, visuel ajouté.
- [ ] Schéma par résolution : chemin étape→étape→outil, backtracks en rouge, issue. Rendu DAG.
- [ ] Vue par classe canonique : superposition des chemins de toutes les sessions → champion vs concurrents visibles + évolution dans le temps.
- [ ] Onglet/section dédiée dans l'app. Cohérent design system existant (dark, sobre).
- [ ] Tests + tsc 0 + E2E réel (Playwright).

### PHASE 3 — Boucle de feedback + courbe d'apprentissage (le cœur)
Prouver que ça apprend. Tracer injection→session→delta, mesurer, afficher la courbe.
- [ ] Instrumenter l'injection : quelle classe/champion injecté dans quelle session (déjà partiellement via injections.json — relier à l'issue de la session).
- [ ] Mesure du delta : session ayant reçu une injection vs baseline sur la même classe (erreur évitée, turns/backtracks ↓, qualité ↑).
- [ ] Métriques de courbe : récurrence des erreurs ↓, fitness champions ↑, temps de résolution ↓ par classe.
- [ ] Écran « Courbe d'apprentissage » en première page (preuve visible).
- [ ] Tests + tsc 0 + E2E réel.

### PHASE 4 — Fitness ancrée sur les résultats
Arrêter de deviner les poids. Un champion vaut par son impact réel mesuré en Phase 3, pas par sa facilité.
- [ ] Redéfinir fitness : intégrer « a évité une erreur connue » / « a tenu dans les sessions suivantes ».
- [ ] Recalibrer l'élection sur les deltas réels.
- [ ] Boucle complète : apprendre → mesurer → réélire → mieux injecter.
- [ ] Tests + tsc 0 + E2E réel.

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
