# ARBORESCENCE — claude-arcade

```
claude-arcade/
├── package.json              Manifeste Bun/TS + scripts (scan, serve, test, typecheck)
├── tsconfig.json             Config TS stricte (noUncheckedIndexedAccess, verbatimModuleSyntax)
├── .echoforge.yml            Déclaration EchoForge (web, bun, port 4317)
├── .env.example              ARCADE_PORT, CLAUDE_HOME, ARCADE_STATE_DIR
├── start.sh / stop.sh / restart.sh   Gestion serveur + PID + reset logs
├── README.md / STATE.md / TODO.md    Docs norme
├── src/
│   ├── types.ts              Types partagés (Achievement, Aggregate, ScanResult, ScoreSummary…)
│   ├── logger.ts             Logger pino + pino-pretty
│   ├── scan.ts               Orchestrateur : transcripts → agrégat → achievements → score
│   ├── cli.ts                CLI : imprime le résumé arcade dans le terminal
│   ├── scanner/
│   │   ├── session-reader.ts Localise + parse ~/.claude/projects/**/*.jsonl
│   │   ├── tool-classify.ts  Classe un nom d'outil → métrique (Bash, Task, Skill, MCP…)
│   │   ├── metrics.ts        analyzeSession() : une session → compteurs + métadonnées
│   │   ├── fingerprint.ts    Empreinte fichier (mtime+size) partagée scan/consolidation
│   │   ├── cache.ts          Cache incrémental : ne re-parse que les transcripts modifiés
│   │   └── aggregate.ts      Combine les sessions en agrégat plat (lifetime + best_session)
│   ├── notes/                Bridge — notes vivantes prises par Claude pendant la session
│   │   ├── types.ts          NoteKind (decision|contradiction|stack|pattern|summary|artifact|note) + SessionNote
│   │   ├── store.ts          Bucket par cwd (hash sha1) : notes.jsonl append-only + artifacts/ (copie durable)
│   │   └── arcade-note.ts    CLI canal d'écriture : `arcade-note <kind> "<texte>" [--artifact path] [--tag t]`
│   ├── consolidate/          Couches 1-3 — résumés, insights, évolution darwinienne
│   │   ├── types.ts          SummaryFields(+difficulty,problems), SessionSummary(+startTs), Champions/Evolution/Injection
│   │   ├── transcript-digest.ts  Réduit un transcript → digest texte borné (16k) + capture startTs/endTs réels
│   │   ├── session-notes.ts  (Bridge) Rattache les notes du cwd par fenêtre [startTs,endTs] + rend la section digest haute fiabilité
│   │   ├── summary-prompt.ts Prompt TIDD-EC v2 : extrait difficulté + problèmes + resolution_schema (JSON stable)
│   │   ├── summarize.ts      Spawn `claude -p` isolé (zéro MCP, plan, sonnet cloud)
│   │   ├── parse.ts          Extraction + validation robustes du JSON LLM v2 + rétro-compat v1 (testé)
│   │   ├── store.ts          Persistance résumés/insights/graphe/champions/evolution/injections + index idempotent + watermark
│   │   ├── run.ts            Orchestrateur : runConsolidation(...) + consolidateSession(file) + countPending + rebuild C2/C3
│   │   ├── consolidate-session.ts (C3) Worker détaché : consolide UNE session terminée (lock → conso ciblée → trace). Lancé par le hook SessionEnd
│   │   ├── job.ts            Job singleton anti-concurrent (déclenchement manuel app) : progression live + stop
│   │   ├── text-normalize.ts (C2) Normalisation + clé de regroupement (récurrence, catégories)
│   │   ├── insights.ts       (C2) Bilans projet, erreurs/process récurrents, notions
│   │   ├── graph.ts          (C2) Graphe écosystème Obsidian : nœuds + arêtes + santé
│   │   ├── fitness.ts        (C3) Fitness composite auto d'un schéma + breakdown pondéré (UI)
│   │   ├── champions.ts      (C3) Regroupement par catégorie, élection champion par fitness, lignée
│   │   ├── principles.ts     (B) Regroupe les process de pensée par domaine, confiance (1-1/(1+occ)), contradictions, signature + réattache les verdicts
│   │   ├── judge-prompt.ts   (B) Prompt comparatif : pour/contre + puissance des approches concurrentes d'un domaine (JSON strict)
│   │   ├── principle-judge.ts (B) Juge LLM : compare les approches d'un domaine éligible (2+ énoncés), mémoïsé par signature, jamais en consolidation
│   │   ├── judge-job.ts      (B) Job singleton du jugement (déclenchement manuel app : statut/start/stop)
│   │   ├── evolution.ts      (C3) Buckets hebdo sur date réelle : recurrence_rate ↓ + fitness ↑ + tendances
│   │   ├── champion-context.ts (C3/PUSH) Rendu markdown borné d'un champion → contexte injectable
│   │   ├── principle-context.ts (B/PUSH) Rendu markdown borné des principes (globaux, cross-projet) → contexte injectable
│   │   ├── classifier.ts     (C3/PUSH) Texte libre → catégories pertinentes (recouvrement de tokens)
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
│   ├── server/
│   │   ├── api.ts            Bun.serve port 4317 : front + API + SSE + endpoints /api/consolidate(/status|/stop)
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
│                             · BrainGraph.tsx (graphe Obsidian 2D, clic→détail) · NodeDetail.tsx (résumé + transcript)
│                             · ConsolidatePanel.tsx (déclenchement manuel : presets + quota libre + progression + stop)
│                             · SessionsPanel.tsx (difficulté + problèmes + resolution_schema) · ProblemsPanel.tsx (catégories/sévérité)
│                             · SchemasPanel.tsx (champion + breakdown fitness en barres) · EvolutionPanel.tsx (signaux + courbe SVG)
│                             · PrinciplesPanel.tsx (B : domaines de pensée, énoncé dominant, barre de confiance, contradictions)
│                             · InjectionsPanel.tsx (trace des injections PUSH) · SessionEndPanel.tsx (« Temps réel » : consolidations à la volée)
├── systemd/                  Cron zéro-perte ACTIVÉ (timer Persistent=true, mode auto/watermark)
│   ├── claude-arcade-consolidate.service  oneshot : bun run consolidate (ARCADE_AUTO=1, quota 50)
│   ├── claude-arcade-consolidate.timer    OnCalendar=daily + Persistent (rattrapage réveil)
│   └── install.sh            Copie les unités (l'activation reste un go explicite)
└── tests/
    ├── metrics.test.ts       Tests unitaires scanner + engine (fixtures inline)
    ├── parse.test.ts         Tests robustesse parseur JSON LLM v2
    ├── insights.test.ts      (C2) Tests insights / récurrence
    ├── champions.test.ts     (C3) Tests fitness composite + élection champion + lignée
    ├── evolution.test.ts     (C3) Tests buckets, recurrence, tendances (date réelle)
    ├── notes.test.ts         (Bridge) Tests cwdHash, roundtrip bucket, rattachement par fenêtre, rendu section digest
    ├── principles.test.ts    (B) Tests regroupement, confiance, contradiction, polarité dominante
    ├── principle-judge.test.ts (B) Tests signature, éligibilité, réattachement mémoïsé, validation du verdict
    ├── injection.test.ts     (C3) Tests rendu contexte + classifier (+ seuil de score anti-bruit)
    ├── injections-store.test.ts (C3) Tests trace injections (cap, ordre)
    └── session-end.test.ts   (C3) Tests lock de consolidation + trace SessionEnd (ordre, cap)
```

État persisté (hors repo, dans `~/.claude/claude-arcade/`) : `state.json`, `sessions/*.json`, `last-consolidation.json`, `auto-watermark.json`, `insights.json`, `graph.json`, `champions.json`, `evolution.json`, `principles.json`, `judgments.json`, `injections.json`, `session-events.json`, `consolidation.lock` (éphémère), `session-notes/<cwd-hash>/{notes.jsonl,meta.json,artifacts/}` (Bridge).
