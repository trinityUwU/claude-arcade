# STATE — claude-arcade
*Dernière mise à jour : 2026-06-13*

> **NORTH STAR** (`docs/NORTH-STAR.md`, immuable) : organe d'apprentissage continu temps réel sur Claude Code. Critère unique = courbe d'apprentissage PROUVÉE (session N+1 > N). Zéro modèle local, backfill manuel only, intégration via hooks, demande visuelle = graphiques de résolution. Plan magistral 4 phases dans TODO.md.

## Session 2026-06-13 (suite) — VAGUE 5 INCRÉMENT 1 : FONDATION CONFIG OBSERVABLE + VERSIONNÉE (LIVRÉ)
Nouvelle vague (go autonome Chris) : boucler l'apprentissage jusqu'à la config SOURCE (`~/.claude`). Évoluer les skills/prompts validés par les consolidations — RÉÉCRITURE sémantique (jamais append de tokens), CLAUDE.md exclu pour l'instant, git comme filet réversible au patch près. Plan 3 incréments dans TODO.md.
- **`git init ~/.claude`** : whitelist STRICTE (`.gitignore` ignore tout `/*` puis ré-autorise CLAUDE.md, rules/, commands/, skills/, settings.json). Blacklist refusée (trop risqué). `.mcp.json` exclu après détection d'une **clé Stripe en clair** dedans. Baseline commit `6f5a62c`, 118 fichiers config, zéro secret/transcript.
- **`src/config/`** : `paths.ts` (`configRoot()` = `~/.claude`, override `ARCADE_CONFIG_ROOT` ; `isPatchable` = hors CLAUDE.md et settings). `git.ts` (wrapper scopé : isRepo/fileHistory/fileDiff/commitPaths/revertCommit via Bun.spawn, error-handled+logged). `scan.ts` (scan CLAUDE.md+rules+skills+commands+settings, parse frontmatter name/description sans dep, détection `<!-- arcade:managed -->`, flag patchable). `types.ts` (ConfigEntry/Tree/Commit/File).
- **API** : `/api/config` (tree), `/api/config/file?path=`, `/api/config/history?path=` — **garde whitelist** (refuse 403 tout chemin hors entries scannées, anti-traversal, même principe que `/api/artifact`).
- **App** : onglet « Config » (groupe Arcade, icône SlidersHorizontal). `ConfigPanel.tsx` : arbo par kind (Instructions/Skills/Commandes/Réglages) + compteur d'usage par skill (réutilise `/api/skills`) + détail = badges managé/patchable, historique git, contenu. Design dark cohérent, Framer Motion.
- **Validé E2E RÉEL** : restart serveur → `/api/config` (versioned:true, CLAUDE.md patchable:false, skills patchable:true) → Playwright : onglet Config → détail humanizer (8×) → historique git (commit baseline rendu) + contenu SKILL.md. 96/96 tests (+5), tsc 0, 0 erreur console/serveur.
- **Reste vague 5** : INC.2 couverture (gaps/morts) dans rebuildInsights ; INC.3 graduation + write-back (toggles auto/manuel par catégorie, gate anti-bloat, prompt-architect, élagage=archivage).

## Session 2026-06-13 (suite) — ONGLET APPRENTISSAGE INTERACTIF (LIVRÉ)
Même drill-down sur la courbe. `LearningEncounter` gagne `topic` (propagé par learning.ts). `LearningPanel` : courbes DÉPLIABLES (chevron) → liste des rencontres avec provenance (`SourceBadge` projet+date + sujet + fitness + tours + injecté + outcome), chaque rencontre cliquable → `SessionDrawer`. Sparkline : barres cliquables (stopPropagation) → session source. Validé E2E réel : « workflow edition fichier » déplie 2 rencontres (StockIOP / echo-trading), clic → drawer (qualité 72 + transcript). 91 tests, tsc 0, 0 page-error.

## Session 2026-06-13 (suite) — CARTES DE RÉSOLUTION CLIQUABLES → SESSION SOURCE (LIVRÉ)
Remonter du schéma à la conversation d'origine en un clic.
- Extraction de la logique détail-session de `NodeDetail.tsx` vers `SessionDetail.tsx` partagé (résumé `/api/session/:id` + transcript repliable `/api/transcript/:id`) + `SessionDrawer` (panneau latéral réutilisable). NodeDetail refactoré (zéro duplication).
- `ResolutionFlow` : prop `onOpen` → carte cliquable (cursor, hover fuchsia, icône PanelRightOpen). `ResolutionsPanel` : état `open` + `SessionDrawer` (AnimatePresence) ; titre = sujet de session, sous-titre = problème.
- Validé E2E réel : clic carte « workflow edition fichier » → drawer (qualité 72, wins/erreurs/décisions/tags echo-trading) → « Voir le transcript » → tours Chris/Claude rendus. 91 tests, tsc 0, 0 page-error.

## Session 2026-06-13 (suite) — PROVENANCE DES RÉSOLUTIONS (LIVRÉ)
Retour Chris : on ne voyait pas à quoi une résolution était liée (projet, cible, contexte). Ajout de la traçabilité de source.
- `SchemaInstance` gagne `topic` (sujet de session, propagé par `champions.ts`). `format.tsx` : `SourceBadge` (basename du cwd + date + icône par famille : Boxes=/mnt/projects, Target=bug bounty/cible, Folder=autre, tooltip=chemin complet).
- `ResolutionFlow` : badge source + sujet de session en italique sur chaque carte. `ResolutionsPanel` : ligne « Rencontré dans : » (projets distincts) au niveau classe. `SchemasPanel` : badge source sur chaque SchemaCard.
- Validé E2E réel : « workflow edition fichier » montre projects/StockIOP + sujets de session lisibles. 91 tests, tsc 0, 0 page-error. (rebuild champions pour peupler topic.)

## Session 2026-06-13 (suite) — PHASE 4 : FITNESS ANCRÉE SUR LES RÉSULTATS (LIVRÉ)
Corrige le biais de fond : l'ancienne fitness récompensait la FACILITÉ (1/tours) → un problème dur bien résolu perdait contre un trivial.
- `fitness.ts` : effort (tours, retours) désormais normalisé par un BUDGET de sévérité (`SEVERITY_BUDGET` trivial 1/0, minor 3/1, major 8/3). `parts.turns = 0.35·min(1, budget/tours)`, idem retours. Plein score si dans l'enveloppe attendue, dégradation au-delà. Borné [0,1]. `computeFitness`/`fitnessBreakdown` prennent `severity` (défaut "minor" → rétro-compat). Erreurs d'outil + qualité inchangées (indépendantes de la difficulté).
- Propagé : `champions.ts` et `learning.ts` passent `p.severity`. `SchemasPanel` passe `c.severity` + labels « tours / budget » + sous-titre.
- **Pas de boucle** : la fitness reste pure (severity = donnée d'instance). La durabilité « a tenu dans les sessions suivantes » est mesurée séparément par la courbe Phase 3 (trend), pas réinjectée dans la fitness (éviterait la dépendance circulaire champions↔learning).
- 3 nouveaux tests (major dans budget non pénalisé, major=trivial parfait à effort plein, médiocre hors budget bas). 91 tests, tsc 0, E2E réel (rebuild, Schémas rendus, 0 erreur console).

## Session 2026-06-13 (suite) — PHASE 3 : BOUCLE DE FEEDBACK + COURBE D'APPRENTISSAGE (LIVRÉ)
Le cœur du North Star : PROUVER que l'exécution progresse (session N+1 > N), pas le supposer.
- `learning.ts` (déterministe, zéro LLM) : pour chaque classe canonique vue 2+ fois, reconstruit la trajectoire chronologique des résolutions (fitness, tours, outcome). **Attribution causale d'injection** par cwd + fenêtre temporelle (même mécanisme que le bridge de notes) : une rencontre est `injected` si une injection de cette classe a touché le projet pendant la session. `injectionLift` = fitness moyen injecté − non injecté = la mesure causale de l'impact du PUSH (null si un groupe vide). Agrégats : recurringClasses, improving/worsening, avgFitnessDelta, avgTurnsDelta.
- `LearningData` + `ClassLearningCurve` + `LearningEncounter` (types). `learning.json` + `/api/learning`. Branché dans `rebuildInsights` (régénéré à chaque consolidation, gratuit).
- `LearningPanel.tsx` : onglet « Apprentissage » placé EN TÊTE du groupe (la preuve d'abord). KPI cards (dont lift causal mis en avant) + trajectoire par classe (sparkline fitness, anneau bleu = rencontre injectée, Δ fit / Δ tours colorés, badge ⚡ injections).
- Validé E2E réel (rebuild déterministe sur summaries réels) : 2 classes récurrentes détectées, deltas calculés, lift null (données d'injection encore rares — honnête, se densifie). 6 tests learning (89 total), tsc 0, 0 erreur console.

## Session 2026-06-13 (suite) — PHASE 2 : GRAPHIQUES DE RÉSOLUTION (LIVRÉ)
Réponse à la demande visuelle de Chris : pour chaque classe de problème, le CHEMIN de résolution en graphique, pas que du texte. Le texte des étapes est conservé mais devient visuel.
- `ResolutionFlow.tsx` : timeline verticale (rail continu coloré par outcome, nœuds d'étapes numérotés, nœud terminal = issue résolu/partiel/non-résolu, outils en pied, métriques tours/retours/erreurs avec teinte d'alerte). Framer Motion (apparition séquentielle stagger).
- `ResolutionsPanel.tsx` : onglet « Résolutions » (nav Apprentissage). Liste des classes canoniques à gauche ; à droite le champion en avant (couronne + fitness) + définition canonique + approches concurrentes en grille côte à côte → comparaison visuelle des chemins. Charge `/api/champions` + `/api/canonical`.
- Câblé : `View` + Sidebar (icône GitBranch) + ViewRouter. tsc 0, E2E Playwright (rendu conforme, assert « Approches concurrentes », 0 erreur console sur load propre).

## Session 2026-06-13 (suite) — PHASE 1 : MATCHING CANONIQUE DES PROBLÈMES (LIVRÉ)
Reconnaître le « même problème » entre sessions/projets SANS modèle local. Le `claude -p` de consolidation (déjà payé, 1×/session) range chaque problème dans une taxonomie canonique évolutive. Remplace le classifier token-overlap.
- `canonical.ts` : registre `canonical-classes.json` (id, nom, définition de CLASSE, occurrences) + `resolveCanonical` déterministe (rattache par id puis par nom normalisé, sinon crée) + `problemKey` (canonicalClassId sinon fallback groupingKey → rétro-compat v1-v3).
- `summary-prompt.ts` v3→v4 : index borné des classes existantes injecté ; le LLM assigne chaque problème à une classe existante (réutilise l'id) ou en propose une nouvelle. `parse.ts` lit `canonical_class`, hint consommé puis retiré.
- `champions.ts` + `evolution.ts` regroupent par `problemKey` (au lieu de `groupingKey(category)`) ; labels = noms canoniques. `run.ts` charge/résout/persiste le registre dans `summarizeOne`. `/api/canonical`.
- Validé E2E réel (1 session consolidée, 1 passe) : 4 classes créées avec définitions génériques de classe, `canonicalClassId` rattaché, hint absent du JSON persisté. 8 tests canonical (83 total), tsc 0, 0 erreur console.

## Session 2026-06-13 (suite) — VUE « SKILLS LES PLUS UTILISÉS » (LIVRÉ)
Onglet « Skills » (groupe Arcade), demandé par Chris. Déterministe, zéro token LLM. Le scanner capture désormais le NOM du skill (`input.skill` du tool Skill) par session (`metrics.ts` → `SessionStats.skills`), `rankSkills` (aggregate.ts) classe par invocations totales puis sessions distinctes, exposé via `ScanResult.topSkills` + `/api/skills`. `SkillsPanel.tsx` : barres proportionnelles (rang, nom mono, count, sessions). `CACHE_VERSION` 1→2 pour forcer un re-parse complet (sinon les sessions en cache n'ont pas le nom de skill). Validé E2E réel : 20 skills, end-session 21×/20 sessions, autonomous-dev 14×, humanizer 8×. 75/75 tests, tsc 0, Playwright 0 page-error.

## Session 2026-06-13 (suite) — BRIDGE DE NOTES VIVANTES (LIVRÉ)
Pont entre la discussion en cours et la consolidation : Claude prend des notes EN DIRECT (`arcade-note`), rattachées ensuite au résumé comme **source haute fiabilité**, et affichées dans l'app avec leurs artefacts ouvrables. Réponse au besoin de Chris ("une qualité qu'on puisse palper", capter systématiquement le « note ça en mémoire »).
- **Canal d'écriture** (`src/notes/`) : CLI `arcade-note <kind> "<texte>" [--artifact path] [--tag t]` (wrapper `bin/arcade-note` + symlink `~/.local/bin` → appelable depuis tout cwd). kinds = decision|contradiction|stack|pattern|summary|artifact|note. Bucket par cwd (`session-notes/<sha1-16>/`) : `notes.jsonl` append-only + `meta.json` (cwd) + `artifacts/` (copie durable de l'original via `--artifact`). 100% local, pas de MCP.
- **Rattachement** (`session-notes.ts`) : `loadNotesForSession(cwd, startTs, endTs)` filtre par fenêtre temporelle (marge 2 min) — PAS le session_id (que l'agent ne connaît pas de façon fiable). `digest` capture désormais `endTs`. Multi-session même cwd en parallèle = cas rare accepté (MVP).
- **Injection digest** : `renderNotesSection` ajoute un bloc « NOTES TEMPS RÉEL — haute fiabilité » au digest avant le `claude -p` → le résumeur privilégie les notes sur sa reconstruction. `SessionSummary` gagne `endTs` + `notes[]`. Notes attachées POST-HOC (pas produites par le LLM) → zéro changement parse, anciens résumés → `notes:[]`.
- **App** : section « Notes de session » dans SessionsPanel (badge couleur par kind + tags + lien artefact ouvrable) + badge compteur dans l'en-tête. Route `/api/artifact?path=` sert l'archive et **refuse tout chemin non référencé (403)**.
- **Convention** : section `01b` ajoutée au CLAUDE.md global de Chris (noter décisions/contradictions/stack/patterns/artefacts au fil de l'eau).
- **Validé E2E sur données RÉELLES** : note datée injectée dans la fenêtre d'une vraie session → `claude -p` réel → résumé persisté avec 2 notes → UI rendue (Playwright) → le LLM **cite les notes** dans la ligne difficulté (preuve qu'il les a lues). Sécurité `/etc/passwd` → 403. Données E2E nettoyées après coup. 73/73 tests (+5), tsc 0.

## Session 2026-06-13 (suite) — COUCHE (B) : principes / process de pensée (VAGUE 1 LIVRÉE)
Capturer COMMENT Chris veut qu'on travaille/code depuis le chatting naturel (pas un bug), mettre les méthodes en compétition, garder les plus confiantes, les injecter pour conditionner les sessions futures (cross-projet). (A) = problèmes techniques (fitness d'exécution, déjà là) ; (B) = principes de pensée (qualitatif, global). Les deux coexistent.
- **Data v3** : `Principle {id, statement, domain, trigger, polarity (positive/negative), source (stated/inferred), rationale}` + `SummaryFields.principles`. SCHEMA_VERSION 2→3. Prompt v3 : extraction des principes (explicites "fais toujours X" / implicites validés) + exemple. Parse v3 : `validatePrinciple` + rétro-compat (v1/v2 absent → `[]`).
- **Compétition déterministe** (`principles.ts`, zéro LLM) : regroupement par `groupingKey(domain)`, confiance = `1 - 1/(1+occ)` (1×→0.5, 3×→0.75) ×0.5 si **contesté** (un même énoncé porte les deux polarités = contradiction détectée), polarité dominante = majorité, énoncé représentant = instance la plus récente de la polarité dominante, `statedCount`. Persisté `principles.json`, rebuild dans `rebuildInsights`.
- **PUSH** : `principle-context.ts` (rendu borné, GLOBAL cross-projet — un principe conditionne la manière de coder partout) branché dans `session-start.ts` (champions projet + principes globaux en une injection). Tri : énoncés explicites de Chris d'abord, puis confiance.
- **App** : onglet « Principes » (`PrinciplesPanel.tsx`, nav Apprentissage) — liste des domaines (⚠ si contesté), carte énoncé dominant + barre de confiance + badge à faire/à éviter, instances en compétition (énoncé/déduit, trigger, rationale, projet, date).
- **Validé E2E sur données RÉELLES** : consolidation de 4 sessions réelles en v3 (251s, sonnet cloud) → 7 domaines de principes extraits, qualité excellente (ex "externaliser ExecStart dans un wrapper systemd", "remonter DB→API→frontend avant de toucher au code"). 1 domaine déjà récurrent 2× (confiance 0.667) → **compétition darwinienne fonctionne sur du réel**. Panneau Playwright 0 erreur console. Injection SessionStart vérifiée (2984 chars : champions + bloc principes). 72/72 tests (+10), tsc 0.
## Session 2026-06-13 (suite) — COUCHE (B) VAGUE 2 : LLM-judge pour/contre + puissance (LIVRÉE)
Quand un domaine de principes oppose 2+ énoncés distincts, un `claude -p` isolé compare les approches : pour/contre, **puissance relative 0-1**, et une recommandation arbitrée. C'est le cœur de la vision Chris ("on doit avoir les pour et les contre, des process plus ou moins puissants, distincts dans l'app et les injections").
- **Module** : `judge-prompt.ts` (prompt comparatif JSON-strict), `principle-judge.ts` (`judgePrinciples` : sélectionne les domaines éligibles `distinctStatements≥2` dont le jugement manque/est périmé, spawn isolé réutilisant `runIsolatedClaude` de summarize, `validateJudgment` testable, écrit `judgments.json` puis rebuild). **Garde** : ne tourne JAMAIS pendant la consolidation (`ARCADE_LOOP_ACTIVE` → abort).
- **Mémoïsation par signature** : chaque domaine a une `signature` (énoncés+polarités triés). `buildPrinciples(summaries, judgments)` réattache un verdict seulement si sa signature matche encore → re-juge uniquement quand la matière change. `judgments.json` = source de vérité (survit aux rebuilds déterministes).
- **Déclenchement MANUEL** (coût LLM) : `judge-job.ts` (singleton), endpoints `/api/principles/judge(/status|/stop)`. Bouton « Juger N » dans l'onglet Principes (polling live → « Jugement… » → « Tout jugé »).
- **Injection** : `principle-context.ts` privilégie la `recommendation` du juge (arbitrée) sur l'énoncé brut, badge ⚖.
- **App** : carte « Verdict » (synthèse + classement des approches avec barres de puissance + pour/contre + recommandation).
- **Validé E2E sur données RÉELLES** : jugé le domaine "configuration systemd" (~15s) → classement wrapper 74% / chemin absolu 88%, pour/contre pertinents, reco qui combine correctement les deux ("le wrapper sans chemin absolu reste cassé"). Verdict réattaché via signature, affiché panneau, mémoïsé (pending 1→0). 68/68 tests (+6), tsc 0.
- **Reste (B)** : approches multiples par problème intra-session (Problem.approaches) — JUGÉ PRÉMATURÉ (data-starved + recouvre champions/judge déjà livrés ; à faire après densification, sinon surcouche sans différence visible). Densification = re-consolidation v3 manuelle par Chris.

## Session 2026-06-13 (suite) — Phase 3 : hook SessionEnd (consolidation temps réel) + seuil classifier
- **Seuil de score au classifier d'injection** : `classifier.ts` filtre `score >= 3` (au lieu de `>0`). Score = labelScore·2+descScore·1 ; un token isolé (1/2) est rejeté → coupe le bruit du hook UserPromptSubmit sur messages méta. Override `ARCADE_CLASSIFIER_MIN_SCORE`. +2 tests anti-bruit.
- **Hook SessionEnd LIVRÉ & ACTIF** : à chaque fin de discussion (reason close/clear/resume/logout) la session est consolidée *immédiatement*, sans attendre le cron systemd. Chaîne : `session-end.ts` (hook, gardes anti-récursion reason=prompt_input_exit + ARCADE_LOOP_ACTIVE, détache un worker `detached+unref` qui survit à la fermeture du terminal) → `consolidate-session.ts` (worker : lock fichier global → `consolidateSession(file)` → trace) → `run.ts::consolidateSession` (conso ciblée idempotente + rebuildInsights) → `store.ts` (lock O_EXCL+TTL, `appendSessionEvent`). Trace `session-events.json` + /api/session-events + onglet « Temps réel » (SessionEndPanel). **install-hooks.sh relancé → 3 hooks actifs.**
- **Token-neutre vs systemd** : chaque nouvelle session consolidée une seule fois (idempotence — premier qui passe marque, l'autre skip). SessionEnd = temps réel ; systemd = filet de rattrapage pour les morts brutales (kill -9 / fermeture sauvage où SessionEnd ne fire pas).
- Validé E2E : gardes anti-récursion (0 event), câblage "skipped" (gratuit), vraie conso (q78, schemaV2, 3 problèmes, ~10s, lock libéré), panneau Playwright 0 erreur console. 52/52 tests, tsc 0.
- **État données réel** : 52 résumés (12 v2, 7 avec problèmes), 31 catégories / 32 problèmes, 1 seule catégorie vue 2× → pas encore de vraie compétition darwinienne. Pipeline d'extraction validé excellent. Densification = consolidation manuelle du backlog (~525) par Chris, à son rythme (décision : pas de backfill auto, trop de tokens). Le système se densifie passivement via SessionEnd+systemd au fil des sessions.

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
