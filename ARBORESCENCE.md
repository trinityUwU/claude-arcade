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
│   │   └── aggregate.ts      Combine les sessions en agrégat plat (lifetime + best_session)
│   ├── engine/
│   │   ├── catalog.ts        ACHIEVEMENTS (IDs stables, tiers Copper→Olympian)
│   │   ├── evaluate.ts       Évalue un achievement → état + tier + progression
│   │   ├── score.ts          Score global, rang, agrégats par catégorie
│   │   └── state.ts          state.json local : unlocks + recent + détection nouveaux paliers
│   ├── server/
│   │   └── api.ts            Bun.serve port 4317 : sert le front + API (scan mémoïsé, /rescan)
│   └── loop/                 (Phase 3) review.ts + merge-draft.ts
├── bunfig.toml               Plugin bun-plugin-tailwind pour le bundling CSS
├── web/                      Front React/Tailwind v4/Framer Motion (dark, bundlé par Bun)
│   ├── index.html            Entrypoint (import main.tsx + styles.css)
│   ├── styles.css            Tailwind v4 + thème (couleurs de tier, halos)
│   ├── main.tsx              Montage React
│   ├── App.tsx               Fetch /api/achievements + filtre catégories + grille
│   ├── lib/tiers.ts          Couleurs de tier, halos, icônes (emoji)
│   └── components/           ScoreHeader.tsx · BadgeCard.tsx
├── hooks/                    (Phase 3) session-end.sh
└── tests/
    └── metrics.test.ts       Tests unitaires scanner + engine (fixtures inline)
```
