# Claude Arcade ☤

Un dashboard arcade + une boucle d'auto-amélioration pour **Claude Code**. Tout tourne en local, sans API externe : la seule dépense de tokens passe par ton abonnement Claude Code, et seulement quand tu cliques.

Le projet part du plugin `hermes-achievements` (@PCinkusz, MIT) de Hermes Agent, transposé sur les données réelles de Claude Code.

L'idée derrière (détaillée dans `docs/NORTH-STAR.md`) : faire que Claude Code apprenne d'une session à l'autre. Ne pas répéter les mêmes erreurs, rejouer les schémas de résolution qui ont marché ailleurs, et le prouver par une courbe plutôt que de le supposer.

## Ce qu'il y a dedans

1. **Dashboard arcade** — scanne `~/.claude/projects/**/*.jsonl` et débloque des badges, du Copper à l'Olympian, selon ton activité réelle. Aucun LLM ici : du scan local, point.

2. **Consolidation en temps réel** — à chaque fin de session, le hook `SessionEnd` lance un `claude -p` isolé (une seule passe) qui résume ce qui vient de se passer : la difficulté, les problèmes rencontrés et leur schéma de résolution, les principes de travail dégagés. Le backfill de l'historique reste manuel, déclenché depuis l'onglet Conso — jamais un batch qui crame des tokens dans le vide.

3. **Apprentissage continu** — le cœur du projet :
   - **Classes canoniques** : le même problème est reconnu d'un projet à l'autre. Pas de modèle local pour ça — c'est le LLM de consolidation qui range chaque cas dans sa classe.
   - **Graphiques de résolution** (onglet Résolutions) : le chemin de chaque résolution en visuel, le champion face aux approches concurrentes.
   - **Courbe d'apprentissage** (onglet Apprentissage) : les classes déjà vues se résolvent-elles mieux avec le temps ? L'injection aide-t-elle vraiment ? C'est mesuré.
   - **Injection** : les hooks `SessionStart` et `UserPromptSubmit` remettent le meilleur schéma connu dans le contexte des sessions suivantes.

4. **Diagnostic de config** (onglet Diagnostic) — audite ta config `~/.claude` selon les normes Anthropic.
   - **Base déterministe et gratuite.** Zéro token, dès le premier lancement sur n'importe quelle machine. Il repère les fichiers surchargés (qui coûtent cher en contexte injecté), les fichiers trop maigres, ceux sans description ou sans trigger, ceux rédigés ailleurs qu'en anglais (l'anglais maximise le suivi d'instructions sur les modèles Anthropic), les blocs sans aucune structure.
   - **Audit profond à la demande.** Un `claude -p` par fichier (sonnet, en streaming, coût affiché) donne un verdict nuancé et une piste de réécriture.
   - **Boucle de correction.** Un bouton « Corriger » lance opus, strict, pour réécrire le fichier selon son analyse, sans perdre de détail ni de fonctionnalité. Tu relis, tu appliques, et chaque application est un commit git isolé donc réversible. Une fois appliquée, l'analyse se réinitialise et la boucle peut repartir sur la version corrigée.
   - **Historique et restauration.** Chaque upgrade est gardé : contenu avant/après, analyse, coût. Tu peux rouvrir n'importe quel état passé et le restaurer en un commit.
   - **Détection de drift.** Si un fichier déjà corrigé est modifié ailleurs que dans Arcade, l'app le voit, l'affiche en badge et glisse la dérive dans l'historique avec le diff. À toi de la garder ou de revenir en arrière.

Tout ce qui touche à tes skills passe par un *propose-et-valide* : Arcade montre, tu décides, et git garde la porte de sortie.

## Lancer le projet

Linux, macOS et Windows. Il te faut [Bun](https://bun.sh) et le CLI `claude`. Le scan, le dashboard et le diagnostic déterministe tournent même sans le CLI ; seules la consolidation et les audits profonds s'en servent. Au premier lancement, Arcade lit **ta** config `~/.claude` tout seul, rien à configurer.

```bash
bun install
bun run scan        # scan CLI : achievements + score depuis tes vraies sessions
./start.sh          # dashboard → http://localhost:4317
./stop.sh
```

## Stack

Bun et TypeScript. React, Tailwind et Framer Motion pour un front en thème sombre. Le serveur tourne sur `Bun.serve()`, port 4317. L'état d'Arcade vit dans `~/.claude/claude-arcade/`, hors du dépôt : ta config et tes données restent chez toi.

## Ports

| Service | Port |
|---|---|
| Dashboard | 4317 |
