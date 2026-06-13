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
│   │   ├── store.ts          Persistance résumés/insights/graphe + index idempotent + watermark auto
│   │   ├── run.ts            Orchestrateur : runConsolidation({quota,since,onProgress,shouldStop}) + countPending + rebuild C2
│   │   ├── job.ts            Job singleton anti-concurrent (déclenchement manuel app) : progression live + stop
│   │   ├── text-normalize.ts (C2) Normalisation + clé de regroupement (récurrence)
│   │   ├── insights.ts       (C2) Bilans projet, erreurs/process récurrents, notions
│   │   ├── graph.ts          (C2) Graphe écosystème Obsidian : nœuds + arêtes + santé
│   │   ├── transcript-view.ts Transcript nettoyé pour le panneau de détail (anti-bruit harness)
│   │   ├── cli.ts            `bun run consolidate` — manuel (tout backlog) ou auto (ARCADE_AUTO=1 → watermark, zéro rattrapage)
│   │   └── empty-mcp.json    Config MCP vide (isolation : aucun serveur chargé)
│   ├── engine/
│   │   ├── catalog.ts        ACHIEVEMENTS (IDs stables, tiers Copper→Olympian)
│   │   ├── evaluate.ts       Évalue un achievement → état + tier + progression
│   │   ├── score.ts          Score global, rang, agrégats par catégorie
│   │   └── state.ts          state.json local : unlocks + recent + détection nouveaux paliers
│   ├── server/
│   │   ├── api.ts            Bun.serve port 4317 : front + API + SSE + endpoints /api/consolidate(/status|/stop)
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
│   └── components/           Sidebar.tsx (onglets Arcade/Cerveau/Conso) · Topbar.tsx · BadgeCard.tsx
│                             · BrainGraph.tsx (graphe Obsidian 2D, clic→détail) · NodeDetail.tsx (résumé + transcript)
│                             · ConsolidatePanel.tsx (déclenchement manuel : presets + quota libre + progression + stop)
├── systemd/                  Cron zéro-perte ACTIVÉ (timer Persistent=true, mode auto/watermark)
│   ├── claude-arcade-consolidate.service  oneshot : bun run consolidate (ARCADE_AUTO=1, quota 50)
│   ├── claude-arcade-consolidate.timer    OnCalendar=daily + Persistent (rattrapage réveil)
│   └── install.sh            Copie les unités (l'activation reste un go explicite)
├── hooks/                    (Phase 3) session-end.sh
└── tests/
    ├── metrics.test.ts       Tests unitaires scanner + engine (fixtures inline)
    └── parse.test.ts         Tests robustesse parseur JSON LLM
```
