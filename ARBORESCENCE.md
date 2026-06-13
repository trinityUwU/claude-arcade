# ARBORESCENCE — claude-arcade

```
claude-arcade/
├── package.json              Manifeste Bun/TS + scripts (scan, serve, test, typecheck)
├── tsconfig.json             Config TS stricte (noUncheckedIndexedAccess, verbatimModuleSyntax)
├── .echoforge.yml            Déclaration EchoForge (web, bun, port 4317)
├── .env.example              ARCADE_PORT, CLAUDE_HOME, ARCADE_STATE_DIR
├── start.sh / stop.sh / restart.sh   Gestion serveur + PID + reset logs
├── README.md / STATE.md / TODO.md    Docs norme
├── docs/
│   ├── NORTH-STAR.md        Vision directrice immuable (apprentissage continu, critère N+1>N, contraintes dures)
│   └── VISION.md            Architecture cible Consolidation & Brain (4 couches, PUSH vs PULL)
├── src/
│   ├── types.ts              Types partagés (Achievement, Aggregate, ScanResult, ScoreSummary…)
│   ├── logger.ts             Logger pino + pino-pretty
│   ├── scan.ts               Orchestrateur : transcripts → agrégat → achievements → score
│   ├── cli.ts                CLI : imprime le résumé arcade dans le terminal
│   ├── scanner/
│   │   ├── session-reader.ts Localise + parse ~/.claude/projects/**/*.jsonl
│   │   ├── tool-classify.ts  Classe un nom d'outil → métrique (Bash, Task, Skill, MCP…)
│   │   ├── metrics.ts        analyzeSession() : une session → compteurs + métadonnées + skills (nom→count)
│   │   ├── fingerprint.ts    Empreinte fichier (mtime+size) partagée scan/consolidation
│   │   ├── cache.ts          Cache incrémental : ne re-parse que les transcripts modifiés (CACHE_VERSION)
│   │   └── aggregate.ts      Combine les sessions en agrégat plat (lifetime + best_session) + rankSkills (classement skills)
│   ├── notes/                Bridge — notes vivantes prises par Claude pendant la session
│   │   ├── types.ts          NoteKind (decision|contradiction|stack|pattern|summary|artifact|note) + SessionNote
│   │   ├── store.ts          Bucket par cwd (hash sha1) : notes.jsonl append-only + artifacts/ (copie durable)
│   │   └── arcade-note.ts    CLI canal d'écriture : `arcade-note <kind> "<texte>" [--artifact path] [--tag t]`
│   ├── consolidate/          Couches 1-3 — résumés, insights, évolution darwinienne
│   │   ├── types.ts          SummaryFields(+difficulty,problems,canonicalClassId), SessionSummary, Canonical/Champions/Evolution/Learning/Injection
│   │   ├── transcript-digest.ts  Réduit un transcript → digest texte borné (16k) + capture startTs/endTs réels
│   │   ├── session-notes.ts  (Bridge) Rattache les notes du cwd par fenêtre [startTs,endTs] + rend la section digest haute fiabilité
│   │   ├── summary-prompt.ts Prompt TIDD-EC v4 : difficulté + problèmes + resolution_schema + classe canonique (index injecté) + principes
│   │   ├── canonical.ts      (P1) Registre de classes canoniques + resolveCanonical déterministe + problemKey (reconnaît le même problème cross-projet)
│   │   ├── summarize.ts      Spawn `claude -p` isolé (zéro MCP, plan, sonnet cloud) ; passe l'index canonique au prompt
│   │   ├── parse.ts          Extraction + validation robustes du JSON LLM v4 (+canonical_class hint) + rétro-compat v1-v3 (testé)
│   │   ├── store.ts          Persistance résumés/insights/graphe/champions/evolution/canonical/learning/injections + index idempotent + watermark
│   │   ├── run.ts            Orchestrateur : runConsolidation(...) + consolidateSession(file) + countPending + rebuild C2/C3 (+learning)
│   │   ├── consolidate-session.ts (C3) Worker détaché : consolide UNE session terminée (lock → conso ciblée → trace). Lancé par le hook SessionEnd
│   │   ├── job.ts            Job singleton anti-concurrent (déclenchement manuel app) : progression live + stop
│   │   ├── text-normalize.ts (C2) Normalisation + clé de regroupement (récurrence, catégories)
│   │   ├── insights.ts       (C2) Bilans projet, erreurs/process récurrents, notions
│   │   ├── graph.ts          (C2) Graphe écosystème Obsidian : nœuds + arêtes + santé
│   │   ├── fitness.ts        (C3/P4) Fitness composite — effort normalisé par budget de sévérité (ancrée sur la difficulté, pas la facilité) + breakdown
│   │   ├── learning.ts       (P3) Boucle de feedback : trajectoire fitness par classe récurrente + injectionLift causal (cwd+fenêtre) — la PREUVE N+1>N
│   │   ├── champions.ts      (C3) Regroupement par classe canonique (problemKey), élection champion par fitness, lignée
│   │   ├── principles.ts     (B) Regroupe les process de pensée par domaine, confiance (1-1/(1+occ)), contradictions, signature + réattache les verdicts
│   │   ├── judge-prompt.ts   (B) Prompt comparatif : pour/contre + puissance des approches concurrentes d'un domaine (JSON strict)
│   │   ├── principle-judge.ts (B) Juge LLM : compare les approches d'un domaine éligible (2+ énoncés), mémoïsé par signature, jamais en consolidation
│   │   ├── judge-job.ts      (B) Job singleton du jugement (déclenchement manuel app : statut/start/stop)
│   │   ├── evolution.ts      (C3) Buckets hebdo sur date réelle : recurrence_rate (par classe canonique) ↓ + fitness ↑ + tendances
│   │   ├── champion-context.ts (C3/PUSH) Rendu markdown borné d'un champion → contexte injectable
│   │   ├── principle-context.ts (B/PUSH) Rendu markdown borné des principes (globaux, cross-projet) → contexte injectable
│   │   ├── classifier.ts     (C3/PUSH) Texte libre → catégories pertinentes (recouvrement sur le vocabulaire canonique)
│   │   ├── redate-summaries.ts (C3) Migration zéro-token : redate les résumés via leur transcript + rebuild
│   │   ├── transcript-view.ts Transcript nettoyé pour le panneau de détail (anti-bruit harness)
│   │   ├── cli.ts            `bun run consolidate` — manuel (tout backlog) ou auto (ARCADE_AUTO=1 → watermark, zéro rattrapage)
│   │   └── empty-mcp.json    Config MCP vide (isolation : aucun serveur chargé)
│   ├── hooks/                (C3/PUSH) Hooks Claude Code — injection dynamique des champions
│   │   ├── hook-io.ts        Lecture stdin + émission JSON (additionalContext) + garde anti-récursion
│   │   ├── session-start.ts  SessionStart : injecte les champions du projet (cwd) + les principes de travail globaux
│   │   ├── user-prompt-submit.ts UserPromptSubmit : classifie le prompt → injecte le champion pertinent
│   │   ├── session-end.ts    SessionEnd : détache la consolidation temps réel de la session terminée (gardes anti-récursion)
│   │   └── install-hooks.sh  Installe les 3 hooks dans ~/.claude/settings.json (idempotent, backup) — ACTIVÉ
│   ├── engine/
│   │   ├── catalog.ts        ACHIEVEMENTS (IDs stables, tiers Copper→Olympian)
│   │   ├── evaluate.ts       Évalue un achievement → état + tier + progression
│   │   ├── score.ts          Score global, rang, agrégats par catégorie
│   │   └── state.ts          state.json local : unlocks + recent + détection nouveaux paliers · stateDir() (~/.claude/claude-arcade)
│   ├── config/               Vague 5 — observation + versioning + (à venir) évolution de la config ~/.claude
│   │   ├── paths.ts          configRoot() (~/.claude, override ARCADE_CONFIG_ROOT) · isPatchable (hors CLAUDE.md/settings)
│   │   ├── git.ts            Wrapper git scopé ~/.claude : isRepo/fileHistory/fileDiff/commitPaths/revertCommit (Bun.spawn)
│   │   ├── scan.ts           Scan config (CLAUDE.md+rules+skills+commands+settings) · frontmatter · détection région managée · flag patchable
│   │   ├── backup.ts         Backup complète tar.gz horodatée (~/.claude/claude-arcade/config-backups, rétention 30) · snapshotConfig/listBackups — double filet avec git
│   │   ├── coverage.ts       buildCoverage (déterministe) : gaps (creatable/block env-failure|banned) + morts (silentLoad/archivable) — lu à la demande par /api/config/coverage
│   │   ├── banned.ts         Liste manuelle des classes bannies de création (override Chris) · loadBanned/setBanned · /api/config/banned
│   │   └── types.ts          ConfigEntry/ConfigTree/ConfigCommit/ConfigFile
│   ├── server/
│   │   ├── api.ts            Bun.serve port 4317 : front + API + SSE + endpoints /api/{canonical,learning,config(/file|/history),consolidate…}
│   │   └── watch.ts          Surveille ~/.claude/projects → déclenche rescan auto sur activité
├── bin/
│   └── arcade-note           Wrapper bash du CLI de notes (symlink ~/.local/bin/arcade-note → appelable partout)
├── bunfig.toml               Plugin bun-plugin-tailwind pour le bundling CSS
├── web/                      Front React/Tailwind v4/Framer Motion (dark, bundlé par Bun)
│   ├── index.html            Entrypoint (import main.tsx + styles.css)
│   ├── styles.css            Tailwind v4 + thème (couleurs de tier, halos)
│   ├── main.tsx              Montage React
│   ├── App.tsx               Shell app : fetch + flux SSE temps réel + filtre catégories + grille
│   ├── lib/
│   │   ├── tiers.ts          Couleurs de tier + halos
│   │   └── icons.tsx         Mapping noms/catégories → icônes Lucide (zéro emoji)
│   ├── lib/format.tsx        Helpers partagés panneaux : badges (outcome/severity/difficulty), couleurs sémantiques, dates
│   └── components/           Sidebar.tsx (nav 2 groupes : Arcade/Apprentissage) · Topbar.tsx · BadgeCard.tsx
│                             · BrainGraph.tsx (graphe Obsidian 2D, clic→détail) · NodeDetail.tsx (drawer nœud du graphe)
│                             · SessionDetail.tsx (partagé : résumé session + transcript repliable + SessionDrawer latéral réutilisable)
│                             · ConsolidatePanel.tsx (déclenchement manuel : presets + quota libre + progression + stop)
│                             · LearningPanel.tsx (P3 « Apprentissage » : KPI causaux + lift + courbes dépliables → rencontres cliquables (source+topic) → drawer session)
│                             · SessionsPanel.tsx (difficulté + problèmes + resolution_schema) · ProblemsPanel.tsx (catégories/sévérité)
│                             · SchemasPanel.tsx (champion + breakdown fitness severity-aware en barres) · EvolutionPanel.tsx (signaux + courbe SVG)
│                             · ResolutionFlow.tsx (P2 timeline verticale d'un chemin de résolution) · ResolutionsPanel.tsx (P2 « Résolutions » : champion vs concurrents par classe)
│                             · PrinciplesPanel.tsx (B : domaines de pensée, énoncé dominant, barre de confiance, contradictions)
│                             · InjectionsPanel.tsx (trace des injections PUSH) · SessionEndPanel.tsx (« Temps réel » : consolidations à la volée)
│                             · SkillsPanel.tsx (« Skills » : classement des skills les plus utilisés, barres proportionnelles)
│                             · ConfigPanel.tsx (V5 « Config » : arbo ~/.claude par kind, usage par skill, détail = badges managé/patchable + historique git + contenu)
├── systemd/                  Cron zéro-perte ACTIVÉ (timer Persistent=true, mode auto/watermark)
│   ├── claude-arcade-consolidate.service  oneshot : bun run consolidate (ARCADE_AUTO=1, quota 50)
│   ├── claude-arcade-consolidate.timer    OnCalendar=daily + Persistent (rattrapage réveil)
│   └── install.sh            Copie les unités (l'activation reste un go explicite)
└── tests/
    ├── metrics.test.ts       Tests unitaires scanner + engine (fixtures inline) + rankSkills (classement skills)
    ├── parse.test.ts         Tests robustesse parseur JSON LLM v2
    ├── insights.test.ts      (C2) Tests insights / récurrence
    ├── champions.test.ts     (C3/P4) Tests fitness severity-aware + élection champion + lignée
    ├── canonical.test.ts     (P1) Tests resolveCanonical (rattache/crée), problemKey, index canonique
    ├── learning.test.ts      (P3) Tests trajectoire par classe, attribution d'injection, injectionLift causal
    ├── evolution.test.ts     (C3) Tests buckets, recurrence, tendances (date réelle)
    ├── notes.test.ts         (Bridge) Tests cwdHash, roundtrip bucket, rattachement par fenêtre, rendu section digest
    ├── principles.test.ts    (B) Tests regroupement, confiance, contradiction, polarité dominante
    ├── principle-judge.test.ts (B) Tests signature, éligibilité, réattachement mémoïsé, validation du verdict
    ├── injection.test.ts     (C3) Tests rendu contexte + classifier (+ seuil de score anti-bruit)
    ├── injections-store.test.ts (C3) Tests trace injections (cap, ordre)
    └── session-end.test.ts   (C3) Tests lock de consolidation + trace SessionEnd (ordre, cap)
```

État persisté (hors repo, dans `~/.claude/claude-arcade/`) : `state.json`, `sessions/*.json`, `last-consolidation.json`, `auto-watermark.json`, `insights.json`, `graph.json`, `champions.json`, `canonical-classes.json` (P1), `learning.json` (P3), `evolution.json`, `principles.json`, `judgments.json`, `injections.json`, `session-events.json`, `consolidation.lock` (éphémère), `session-notes/<cwd-hash>/{notes.jsonl,meta.json,artifacts/}` (Bridge).
