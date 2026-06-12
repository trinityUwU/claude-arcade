# Claude Arcade — Vision : Consolidation & Brain

> Document d'architecture. Capture la cible long terme du projet au-delà des achievements.
> Statut : validé sur le principe (2026-06-12), à construire après validation de l'archi détaillée.

## Le but ultime

Faire de Claude Code un praticien qui s'améliore session après session. Pas « stocker plus de notes » — **remettre le meilleur en surface automatiquement**, pour que la qualité d'exécution monte en continu et que les erreurs deviennent rares. Claude Arcade est le hub où tout ça se voit et se pilote.

## Principe directeur : PUSH vs PULL

La mémoire sémantique (ChromaDB) est en **PULL** : Claude doit décider de la requêter, et peut oublier ou tomber à côté. C'est pour ça que des choses se perdent.

La pièce manquante est une couche **PUSH** : un digest consolidé — *la crème* — injecté nativement dans le contexte au démarrage de chaque session, sans que Claude ait à le demander.

```
Mémoire sémantique (PULL)  →  stockage exhaustif, requêtable      → on garde
Digest consolidé   (PUSH)  →  la crème, injectée nativement       → on ajoute
```

On ne remplace rien. On ajoute la couche qui manque.

## Architecture — 4 couches

### Couche 1 — Résumé par session (incrémental, cheap)
Pour chaque transcript `~/.claude/projects/**/*.jsonl` pas encore traité, un `claude -p` produit un résumé structuré :
- Projet / sujet de la session
- Process qui ont bien marché (réutilisables)
- Erreurs commises — côté Claude **et** côté Chris (emballements, mauvaises pistes)
- Décisions prises
- Score de qualité d'exécution
Stocké dans `~/.claude/claude-arcade/sessions/<session-id>.json`. Jamais re-résumé (incrémental).

### Couche 2 — Consolidation (1×/jour)
- Regroupe les résumés par projet / sujet.
- Détecte les **liens entre discussions** (même projet, erreurs récurrentes, sujets connexes, même process gagnant).
- Met à jour la mémoire sémantique (dédup, contradictions).
- Produit des **insights** : process gagnants, erreurs récurrentes à éliminer, dérives de Chris, patterns. → `~/.claude/claude-arcade/insights.json`.

### Couche 3 — Le Digest (la crème, PUSH)
Régénéré à chaque consolidation : `~/.claude/BRAIN.md` (+ sections par projet).
Contenu : état des projets actifs, top process gagnants, top erreurs-à-ne-plus-refaire, liens clés.
**Injecté via hook `SessionStart`** (filtré par cwd / projet courant) → Claude l'a nativement à chaque session.
Contrainte dure : **budget token strict**. C'est la crème, pas un dump. Sinon on recrée le bruit qu'on veut tuer.

### Couche 4 — Claude Arcade = hub
Nouveaux onglets, au-delà des achievements :
- **Sessions** — résumés + score de qualité par session
- **Insights** — process gagnants / erreurs récurrentes / dérives
- **Liens / Graphe** — voir ci-dessous (pièce maîtresse)
- **Brain** — le digest courant, lisible
Montre où c'est excellent, où Chris s'est emballé, où Claude a raté, les regroupements par projet/productivité.

#### Le Graphe écosystème (type Obsidian, 2D — pièce maîtresse)
**Pas de 3D / Three.js.** Un graphe 2D plat, façon vue graphe d'Obsidian : un réseau de « neurones »
omniprésent et interconnecté reliant TOUT — notions issues des analyses de conversations, types de
projets, sessions, erreurs récurrentes, process gagnants, skills. Un écosystème complet relié dans
tous les sens, pour comprendre d'un coup d'œil : où on avance, points forts / faibles, quoi
retravailler, où il n'y a aucun problème, où faire attention.
- **Stack reco (à valider)** : `react-force-graph-2d` (canvas, force-directed) ou `d3-force` + canvas. Local, souverain. Jamais Three.js ici.
- **Nœuds** : session · projet · notion/sujet · erreur-récurrente · process-gagnant · skill.
- **Arêtes** : liens détectés par la Couche 2 (consolidation) — co-occurrence, même projet, même erreur, sujets connexes.
- **Sémantique couleur** : vert = sain/fort · rouge-orange = faible/à retravailler · jaune = à surveiller · neutre = sans problème. Taille de nœud = importance/fréquence.
- **Interactions** : zoom/pan, hover détails, clic drill-down, filtres (projet / type / qualité), clusters.
C'est le cœur de la compréhension : l'endroit où Chris voit l'état réel de sa pratique et de ses projets.

## Cron zéro-perte

Pas un cron horaire bête. **systemd user timer avec `Persistent=true`** :
- `OnCalendar=daily` (ou autre cadence).
- `Persistent=true` → si l'heure prévue est passée pendant que le PC dormait, systemd lance la consolidation **au prochain réveil**, automatiquement. Une seule passe de rattrapage, pas N.

Le service est **incrémental et idempotent** : il lit `~/.claude/claude-arcade/last-consolidation.json` (sessions déjà traitées) et ne consolide que le manque.

> Scénario Chris : PC éteint de 18h à 10h le lendemain → au réveil, 1 run consolide tout le backlog accumulé. **Zéro perte, zéro doublon, zéro sur-exécution.**

Unités : `~/.config/systemd/user/claude-arcade-consolidate.{service,timer}`.

## Garde-fous (obligatoires)

1. **Anti-récursion** : la session de review/consolidation (`claude -p`) ne doit pas redéclencher le hook → sentinelle `ARCADE_LOOP_ACTIVE=1`.
2. **Rythme progressif** : commencer **1×/jour**. Plus tard, quand la qualité est prouvée, passer à « toutes les 15 sessions ».
3. **Anti-patterns « Do NOT capture »** (cf. `~/.claude/CLAUDE.md`) appliqués au digest : jamais figer un échec d'environnement, un claim négatif sur un outil, une erreur transitoire résolue.
4. **Budget token du digest** : strict. La crème, jamais un dump.
5. **Propose-et-valide** pour les patchs de skills (déjà acté).

## Phasage suggéré

1. **Ossature** : couche 1 (résumés par session) + systemd zéro-perte. Tout en dépend.
2. Couche 2 (consolidation + liens + insights).
3. Couche 3 (digest BRAIN.md + hook SessionStart).
4. Couche 4 (onglets Arcade : Sessions / Insights / Liens / Brain).

## Décisions actées
- PUSH digest au-dessus de la mémoire sémantique (pas en remplacement).
- systemd `Persistent=true` pour le zéro-perte.
- Consolidation 1×/jour au départ, garde-fous obligatoires.
- Claude Arcade = hub central de visualisation et de documentation.
- **Couche 1 — backfill HYBRIDE** : nouvelles sessions résumées en direct + historique (648 sessions) résumé en tâche de fond, étalé via le cron (quota par run) pour lisser le coût tokens. Le digest s'enrichit progressivement.

## Note d'implémentation — Couche 1 (à concevoir avant de coder)
Le prompt de résumé `claude -p` est le cœur de la qualité — il doit être conçu proprement (via /prompt-architect), pas écrit à la volée. Il produit un JSON structuré stable : `{ project, topic, wins[], errors_claude[], errors_chris[], decisions[], quality_score, links_hint[] }`. Idempotence via `last-consolidation.json` + fingerprint de session. Quota de backfill par run (ex. 20 sessions) pour borner le coût.
