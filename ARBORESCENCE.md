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
│   ├── consolidate/          Couche 1 — résumés de session (Consolidation & Brain)
│   │   ├── types.ts          SummaryFields, SessionSummary, ConsolidationIndex/Run
│   │   ├── transcript-digest.ts  Réduit un transcript volumineux → digest texte borné
│   │   ├── summary-prompt.ts Prompt TIDD-EC du `claude -p` de résumé (JSON stable)
│   │   ├── summarize.ts      Spawn `claude -p` isolé (zéro MCP, plan, sonnet cloud)
│   │   ├── parse.ts          Extraction + validation robustes du JSON LLM (testé)
│   │   ├── store.ts          Persistance résumés + index idempotent (zéro-perte)
│   │   ├── run.ts            Orchestrateur : sélection + quota backfill + idempotence
│   │   ├── cli.ts            `bun run consolidate`
│   │   └── empty-mcp.json    Config MCP vide (isolation : aucun serveur chargé)
│   ├── engine/
│   │   ├── catalog.ts        ACHIEVEMENTS (IDs stables, tiers Copper→Olympian)
│   │   ├── evaluate.ts       Évalue un achievement → état + tier + progression
│   │   ├── score.ts          Score global, rang, agrégats par catégorie
│   │   └── state.ts          state.json local : unlocks + recent + détection nouveaux paliers
│   ├── server/
│   │   ├── api.ts            Bun.serve port 4317 : front + API + flux SSE temps réel (scan mémoïsé, throttle)
│   │   └── watch.ts          Surveille ~/.claude/projects → déclenche rescan auto sur activité
│   └── loop/                 (Phase 3) review.ts + merge-draft.ts
├── bunfig.toml               Plugin bun-plugin-tailwind pour le bundling CSS
├── web/                      Front React/Tailwind v4/Framer Motion (dark, bundlé par Bun)
│   ├── index.html            Entrypoint (import main.tsx + styles.css)
│   ├── styles.css            Tailwind v4 + thème (couleurs de tier, halos)
│   ├── main.tsx              Montage React
│   ├── App.tsx               Shell app : fetch + flux SSE temps réel + filtre catégories + grille
│   ├── lib/
│   │   ├── tiers.ts          Couleurs de tier + halos
│   │   └── icons.tsx         Mapping noms/catégories → icônes Lucide (zéro emoji)
│   └── components/           Sidebar.tsx · Topbar.tsx (titre animé + Live) · BadgeCard.tsx
├── systemd/                  Ossature cron zéro-perte (Persistent=true)
│   ├── claude-arcade-consolidate.service  oneshot : bun run consolidate
│   ├── claude-arcade-consolidate.timer    OnCalendar=daily + Persistent (rattrapage réveil)
│   └── install.sh            Copie les unités (N'ACTIVE PAS — go explicite requis)
├── hooks/                    (Phase 3) session-end.sh
└── tests/
    ├── metrics.test.ts       Tests unitaires scanner + engine (fixtures inline)
    └── parse.test.ts         Tests robustesse parseur JSON LLM
```
