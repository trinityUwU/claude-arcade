# Plan d'exécution — l'Atelier (`src/workshop/`)

> Préparé 2026-06-16 pour reprise après compaction. À lire en premier au démarrage de la
> prochaine session, puis exécuter incrément par incrément (validation Chris entre chaque).

## Cap (décisions déjà verrouillées avec Chris)

- **Moteur = `claude -p` headless** (abonnement Claude Code, zéro API externe). Réutilise
  `runIsolatedClaude(prompt, model, timeoutMs)` de `src/consolidate/summarize.ts`.
- **Boucle fermée apprentissage ↔ outils** : les outils consomment les consolidations
  (créer un skill depuis un champion/classe canonique, réécrire un skill jugé faible).
- **Réutiliser `/prompt-architect`** comme source de vérité, jamais réimplémenter. On charge
  ses fichiers comme contexte injecté (même pattern que `src/audit/pe-rubric.ts`).
- **Tokens uniquement sur action explicite** (un bouton dans l'UI). Jamais en fond.
- **Write-back en propose-et-valide** via `src/config/apply.ts` + `proposals-store` +
  git (snapshot/commit/revert). CLAUDE.md éditable seulement en atelier **manuel**, diff visible.

## Briques existantes à réutiliser (NE PAS réécrire)

| Brique | Fichier | Usage atelier |
|---|---|---|
| `runIsolatedClaude` | `src/consolidate/summarize.ts` | tous les appels claude -p |
| `generateCreate` / `generatePatch` | `src/config/evolve.ts` | création/réécriture de skill (gate anti-bloat, générateur injectable) |
| `extractJson` / `envelopeResult` | `src/consolidate/parse.ts` | parser la sortie claude -p |
| `applyProposal` + `Proposal` | `src/config/apply.ts`, `types.ts` | write-back snapshot+commit+revert |
| juge pour/contre | `src/consolidate/principle-judge.ts` | pattern du comparateur |
| chargement réf prompt-architect | `src/audit/pe-rubric.ts` | modèle pour `pe-context.ts` |
| `useLiveResource` + `reveal` | `web/lib/{live,motion}` | UI silencieuse + motion cohérent |

prompt-architect sur disque : `~/.claude/skills/prompt-architect/SKILL.md` +
`references/claude-prompting-principles.md` + `references/domains/*` + `references/frameworks/*`.

## Domaine `src/workshop/` (screaming architecture, self-contained)

| Fichier | Rôle | Réutilise |
|---|---|---|
| `types.ts` | types du domaine (PromptDraft, SkillDraft, CompareResult…) | — |
| `pe-context.ts` | charge SKILL.md + claude-prompting-principles.md (+ domaine motion si pertinent) en contexte borné, caché | pattern `pe-rubric.ts` |
| `prompt.ts` | rédiger/améliorer un prompt via claude -p + couche prompt-architect ; générateur injectable | `runIsolatedClaude`, `parse` |
| `skill.ts` | créer un skill (from-scratch OU depuis champion) → Proposal `create` | `generateCreate`, `apply` |
| `compare.ts` | comparer 2 prompts/skills : diff déterministe + juge claude -p (gagnant + pourquoi) | pattern `principle-judge` |
| `seed.ts` | pont apprentissage→atelier : « créer un skill depuis cette classe canonique championne » | champions/canonical stores |

## API (toutes POST, action explicite = seule dépense de tokens ; gated `denyRemoteWrite`)

- `POST /api/workshop/prompt`  → `{ task, current? }` → prompt rédigé/amélioré
- `POST /api/workshop/skill`   → `{ mode: "scratch"|"champion", brief|classId }` → Proposal create
- `POST /api/workshop/compare` → `{ a, b, kind }` → verdict + diff

## Front

- `web/components/WorkshopPanel.tsx` + onglet **Atelier** (groupe Arcade, après Diagnostic).
- 3 sous-vues : Prompt Forge · Skill Forge · Comparateur. `useLiveResource`/`reveal`,
  modales en `createPortal` vers `<body>` (cf. leçon AuditPanel), markdown via `web/lib/Markdown.tsx`.
- Skill Forge montre la Proposal → bouton appliquer (propose-et-valide via apply.ts), diff visible.

## Incréments (valider chacun avec Chris)

1. **Fondation + Prompt Forge** : `types.ts` + `pe-context.ts` + `prompt.ts` + `/api/workshop/prompt`
   + onglet Atelier + sous-vue Prompt. Tests avec générateur injectable (zéro token).
2. **Skill Forge** : `skill.ts` + `seed.ts` (scratch + depuis champion) + write-back via apply + UI.
3. **Comparateur** : `compare.ts` + `/api/workshop/compare` + UI diff/juge.
4. **Édition config étendue** : CLAUDE.md manuel guardé (diff + propose-et-valide).

## Garde-fous standards à respecter

Fichiers <500 l, fonctions <35 l, zéro `any`, try/catch+log sur tout I/O/claude -p,
générateurs injectables pour tester sans tokens, commentaires FR (code) / prompts EN.

## Questions à trancher au démarrage (ne pas présupposer)

- Comparateur : diff déterministe **seul** par défaut, juge claude -p **sur bouton** ? (probable oui)
- Prompt Forge : sortie = prompt brut copiable, ou aussi écriture directe dans un fichier cible ?
- Skill Forge depuis champion : seuil mini (occurrences/fitness) pour proposer la création ?
