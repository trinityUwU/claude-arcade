# TODO — claude-arcade
*Dernière mise à jour : 2026-06-13*

## ════ COUCHE 3 — Évolution darwinienne des schémas de résolution — LIVRÉE ════
Le système apprend de ses propres sessions. Grain = LE PROBLÈME. Cf. STATE.md + `logs/report-2026-06-13_07-42.md`.
- [x] **A — data v2** : `SummaryFields` + `difficulty{level,why}` + `problems[]` (resolution_schema). SCHEMA_VERSION 1→2. Budget digest 9000→16000. Rétro-compat v1.
- [x] **B — champions** : `fitness.ts` (composite auto + breakdown), `champions.ts` (élection par catégorie + lignée). `champions.json`, /api/champions(/:category), /api/problems.
- [x] **C — évolution** : `evolution.ts` (buckets hebdo, recurrence_rate ↓ + fitness ↑). `evolution.json`, /api/evolution. Bucketing sur date RÉELLE de session (startTs).
- [x] **D — PUSH** : `champion-context.ts` + `classifier.ts` + hooks `src/hooks/{session-start,user-prompt-submit}.ts` (fail-safe, anti-récursion). Trace `injections.json`, /api/injections. **install-hooks.sh ACTIVÉ (settings.json).**
- [x] **E — app** : nav 2 groupes + 5 onglets Sessions/Problèmes/Schémas/Évolution/Injection. Validé E2E Playwright.
- [x] Fix axe temporel : startTs réel + `redate-summaries.ts` (52 redatés → 4 buckets réels).
- [ ] **Densification** : ~12 sessions en v2, 537 backlog en v1. Re-consolider pour activer comparaisons (2+ occ/catégorie) et tendances. Backfill 25 fait le 13/06.
- [x] **Seuil de score minimum au classifier** (`classifier.ts`) : `DEFAULT_MIN_SCORE=3` (≥2 hits indépendants), override `ARCADE_CLASSIFIER_MIN_SCORE`. Filtre `score >= seuil` au lieu de `> 0`. Coupe le bruit UserPromptSubmit (token isolé rejeté). +2 tests anti-bruit. Live sans rebuild (hook = process frais).
- [ ] À terme : classifier sémantique (embeddings BGE-M3/nomic local) au lieu du recouvrement de tokens.

## ════ COUCHE (B) — Principes / process de pensée — VAGUE 1 LIVRÉE ════
Capturer COMMENT Chris travaille/code depuis le chatting naturel, mettre les méthodes en compétition, injecter les plus confiantes (cross-projet). Cf. STATE.md.
- [x] **Data v3** : `Principle` + `SummaryFields.principles`. SCHEMA_VERSION 2→3. Prompt v3 (extraction explicite/implicite). Parse v3 + rétro-compat.
- [x] **Compétition déterministe** (`principles.ts`) : regroupement par domaine, confiance `1-1/(1+occ)` ×0.5 si contesté, contradiction détectée, polarité dominante. `principles.json` + rebuild.
- [x] **PUSH** : `principle-context.ts` (global cross-projet) branché dans `session-start.ts`. Trace via injections.json.
- [x] **App** : onglet « Principes » (énoncé dominant + confiance + contradictions + instances).
- [x] **Validé E2E réel** : 4 sessions consolidées v3 → 7 domaines, 1 récurrent 2× (0.667). Panneau 0 erreur. Injection 2984 chars. 72/72 tests.
- [x] **LLM-judge pour/contre + puissance** (VAGUE 2) : `judge-prompt.ts` + `principle-judge.ts` + `judge-job.ts`. Domaine éligible (2+ énoncés distincts) → `claude -p` isolé compare (pour/contre + puissance 0-1 + reco), mémoïsé par signature, déclenché manuellement (bouton « Juger »), jamais en consolidation. Endpoints `/api/principles/judge(/status|/stop)`. Carte « Verdict » + injection de la reco arbitrée. Validé E2E réel (systemd : wrapper 74% / chemin absolu 88%). 68/68 tests.
- [ ] **Approches multiples par problème** (`Problem.approaches`) : plusieurs manières pour un même sujet DANS une session → comparées puis recomparées cross-session. PRÉMATURÉ : data-starved + recouvre champions/judge déjà livrés. À faire APRÈS densification (sinon surcouche sans différence visible).
- [ ] **Densification** : re-consolider en v3 pour faire monter occurrences + faire émerger contradictions réelles (manuel, appel de Chris sur le coût).

## ════ BRIDGE DE NOTES VIVANTES — LIVRÉ ════
Claude note au fil de la discussion → consolidation relie au résumé par cwd+fenêtre → app affiche notes + artefacts ouvrables. Emplacement `~/.claude/claude-arcade/session-notes/<cwd-hash>/` (notes.jsonl append-only + artifacts/). Rattachement par cwd + fenêtre [startTs,endTs] (PAS le session_id, marge 2 min). 100% local.
- [x] A. CLI `src/notes/{types,store,arcade-note}.ts` + wrapper `bin/arcade-note` + symlink `~/.local/bin`. kinds = decision|contradiction|stack|pattern|summary|artifact|note. `--artifact` archive une copie durable.
- [x] B. Convention `01b` dans CLAUDE.md global : noter décisions/contradictions/stack/patterns/artefacts au fil de l'eau.
- [x] C. `session-notes.ts` : `loadNotesForSession(cwd, startTs, endTs)` + `renderNotesSection` + branchement `run.ts:summarizeOne`. `endTs` ajouté au digest.
- [x] D. Notes → digest (section « NOTES TEMPS RÉEL — haute fiabilité ») + `SessionSummary.{endTs,notes}`. Notes attachées post-hoc (PAS via le LLM) → aucun changement parse, anciens résumés → `notes:[]`.
- [x] E. App : section « Notes de session » (badge par kind + tags + lien artefact) dans SessionsPanel + badge compteur. Route `/api/artifact?path=` (sert l'archive, refuse tout chemin non référencé → 403).
- [x] F. 5 tests `tests/notes.test.ts` (cwdHash, roundtrip, fenêtre, rendu). Validé E2E réel : note datée → consolidation `claude -p` → résumé persisté avec notes → UI (le LLM cite les notes dans la difficulté). 73/73 tests, tsc 0.

**Ordre global suite (B)** : ~~Bridge #1~~ ✓ > Densification #2 (re-conso v3 manuelle, coût = appel Chris) > Problem.approaches #3 (prématuré tant que data-starved).

## Vision validée — voir docs/VISION.md (Consolidation & Brain)
Système de consolidation 4 couches + digest PUSH (BRAIN.md injecté via SessionStart) + cron zéro-perte (systemd Persistent). But : courbe d'apprentissage continue.
- [x] **Couche 1 — résumé par session + ossature systemd zéro-perte** (livré, validé sur abonnement)
  - [x] Réducteur transcript→digest compact borné (`transcript-digest.ts`, ~2,3k tok)
  - [x] Prompt de résumé (TIDD-EC via /prompt-architect) → JSON stable (`summary-prompt.ts`)
  - [x] Pipeline `claude -p` isolé (zéro MCP, no-session-persistence, plan, modèle `sonnet` cloud) + parseur robuste testé
  - [x] Store + index idempotent zéro-perte/zéro-doublon (`store.ts`, last-consolidation.json) + quota backfill (`run.ts`)
  - [x] Unités systemd `Persistent=true` + install.sh (NON activé — go de Chris requis : dépense tokens)
  - [x] **Consolidation manuelle depuis l'app** (2026-06-13) — onglet « Conso » : compteur en attente, presets 25/50/100 + champ libre + « Tout (N) », progression live (barre + projet courant + compteurs), bouton Arrêter. Backend : `countPending`, `runConsolidation({quota,onProgress,shouldStop})`, job singleton `job.ts`, endpoints `/api/consolidate(/status|/stop)`. Quota 25/j neutralisé pour le manuel.
  - [x] **systemd auto ACTIVÉ** (2026-06-13, sans rattrapage) — timer quotidien `Persistent=true` enabled. Mode auto (`ARCADE_AUTO=1`) = watermark : ne consolide QUE les sessions postérieures à la baseline (posée le 13/06). Le backlog reste au déclenchement manuel. Prochain run 14/06 00:03. Auto+manuel = deux portées distinctes (auto: nouvelles ; manuel: tout).
- [x] **Couche 2 — consolidation (liens + insights + graphe)** (livré, validé sur 19 sessions réelles)
  - [x] Normalisation texte + détection récurrence (`text-normalize.ts`) erreurs/process count≥2
  - [x] Insights : bilans projet (avgQuality), erreurs récurrentes Claude/Chris, process gagnants, notions (`insights.ts`)
  - [x] Graphe écosystème : nœuds (session/projet/notion/erreur/process) + arêtes + sémantique santé (`graph.ts`)
  - [x] Rebuild auto dans l'orchestrateur + endpoints `/api/insights` `/api/graph` `/api/sessions`
- [x] Couche 3 — PUSH natif via hooks SessionStart + UserPromptSubmit (réorientée : injection de schémas champions, pas un BRAIN.md figé — voir bloc Couche 3 en tête) + **SessionEnd (consolidation temps réel de la session terminée)**
- [x] Couche 4 — onglets Arcade (réalisée comme les 5 onglets Apprentissage : Sessions/Problèmes/Schémas/Évolution/Injection)
- [x] Garde-fou anti-récursion (sentinelle `ARCADE_LOOP_ACTIVE=1` + no-session-persistence) · [ ] cadence 1×/j puis /15 sessions

## En cours
- [x] **Phase 3 — hook SessionEnd (consolidation temps réel)** : à chaque fin de discussion (close/clear/resume/logout) la session est consolidée immédiatement, au lieu d'attendre le cron. Worker détaché (detached+unref, survit à la fermeture du terminal), lock fichier global (anti-concurrence), gardes anti-récursion (reason=prompt_input_exit + ARCADE_LOOP_ACTIVE). Trace `session-events.json` + /api/session-events + onglet « Temps réel ». **install-hooks.sh relancé → SessionEnd ACTIF.** Token-neutre vs systemd (idempotence). Validé E2E (conso réelle q78 en ~10s, 0 erreur console).
- [ ] loop/review (claude -p) + onglet Learnings + merge-draft (autre sous-ensemble de la vision — revue active des skills, non commencé)

## ════ LISTE 1 — Graphe écosystème (type Obsidian, 2D) — LIVRÉ ════
Réseau 2D plat façon Obsidian, reliant sessions/projets/notions/erreurs/process. Rendu validé Playwright.
- [x] Stack : `react-force-graph-2d` (canvas, force-directed, look Obsidian). Bundlé local, souverain. Pas de Three.js.
- [x] Modèle de données : nœuds {session, projet, notion, erreur-récurrente, process-gagnant} + arêtes (Couche 2). Cf. `graph.ts`.
- [x] Sémantique couleur : vert=fort · rouge=faible/à retravailler · jaune=à surveiller · neutre. Taille = fréquence (`BrainGraph.tsx`).
- [x] Interactions : zoom/pan, hover tooltip, labels permanents + glyphes de type, panneau de types, légende santé.
- [x] **Clic → panneau de détail** : résumé (qualité, wins, erreurs, décisions, notions) + **transcript nettoyé** (caveats/system-reminder retirés). Endpoints `/api/session/:id` `/api/transcript/:id`.
- [ ] Reste à enrichir : filtres (projet/type/qualité), arêtes notion↔notion (co-occurrence), recherche, focus/highlight des voisins au clic
- [ ] Se densifie avec le backfill complet (actuellement 19 sessions → 34 nœuds)

## ════ LISTE 2 — Stabilité & bug « Live » ════
- [x] **BUG : badge Live clignote** — RÉSOLU. Cause confirmée : rescan bloquant (parse sync de 648 transcripts ~2,5s, relancé /8s) → flux SSE starvé → onerror navigateur. Triple fix livré + validé Playwright (22s, 44/44 « Live », 0 transition, 0 page-error) :
  - [x] Cache incrémental scanner (`src/scanner/cache.ts`, fingerprint mtime+size, persistance disque) → scan froid 3,24s / chaud 0,14s. Fix racine.
  - [x] Heartbeat SSE : commentaire `: keepalive\n\n` toutes les 15s (api.ts).
  - [x] UI tolérante : debounce 5s avant « Hors ligne » (App.tsx) — EventSource reconnecte seul.
- [x] **Vue « skills les plus utilisés »** (LIVRÉ) — onglet « Skills » (groupe Arcade). Capture du nom de skill (`input.skill` du tool Skill) par session dans `metrics.ts`, `rankSkills` (aggregate.ts) classe par invocations + sessions distinctes, `ScanResult.topSkills`, `/api/skills`, `SkillsPanel.tsx` (barres proportionnelles). CACHE_VERSION 1→2 (re-parse). Validé E2E réel (20 skills, end-session 21×). 75/75 tests.
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
