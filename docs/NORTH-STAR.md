# Claude Arcade — NORTH STAR

> Vision directrice de Chris (2026-06-13). **Immuable.** Toute décision et toute action doivent aller dans ce sens. Ne jamais régresser par rapport à ce document. Si un choix le contredit → STOP et signaler.

## Le but ultime

Greffer sur Claude Code un **organe d'apprentissage continu**. Une session faite aujourd'hui ne doit pas être identique à la prochaine : le modèle apprend en temps réel de l'utilisateur — feedbacks, ce qui est important, patterns de résolution — consolide entre sessions, **compare ces consolidations entre elles**, fait des liens, et remet en surface la meilleure solution connue à chaque classe de problème.

Cible concrète : **Claude ne refait pas les erreurs du passé** et **réutilise les patterns de résolution éprouvés** d'un projet à l'autre. On résout souvent le même type de problème, de la même manière, dans des projets différents — Claude doit l'apprendre une fois et le rejouer.

## Critère de réussite (le seul qui compte)

Une session N+1 est **mesurablement meilleure** qu'une session N comparable : moins d'erreurs répétées, résolution plus rapide des classes de problèmes déjà vues, qualité d'exécution qui monte. La courbe d'apprentissage doit être **visible et prouvée**, pas supposée.

## Barre de qualité

Au **minimum la qualité de Hermes Agent** (l'une des meilleures infra agentiques locales — source d'origine du projet). On vise au-delà : performance et qualité massives. Pas une installation simpliste de Claude — une vraie infrastructure d'organisation qui pousse le modèle dans ses retranchements.

## Demande visuelle explicite

Pour chaque problème rencontré (toutes sessions / jours / semaines / projets confondus) : **un graphique / schéma visuel de sa résolution**, pas seulement du texte. Garder le texte existant (messages, problématiques, résolutions) ET ajouter la représentation visuelle des schémas de résolution — voir d'un coup d'œil le chemin emprunté, les bifurcations, les approches en compétition.

## Contraintes dures (non négociables)

1. **Zéro modèle local. Zéro API externe.** Tout passe par l'abonnement Claude Code, depuis l'application Claude Code. Pas de tiers.
2. **Ne pas exploser les quotas.** Pas de batch qui crame des tokens dans le vide (ex : consolider 25 sessions d'un coup = INTERDIT en automatique).
3. **Temps réel obligatoire.** Chaque session qui se termine se consolide *immédiatement* (1 passe), puis se compare aux consolidations passées. C'est le moteur.
4. **Backfill = manuel uniquement.** La consolidation de l'historique passé, c'est Chris qui la déclenche à la main dans l'app, à son rythme, en conscience du coût. Jamais en automatique.
5. **Intégration native Claude Code.** Via les hooks (SessionEnd / SessionStart / UserPromptSubmit). On ne recrée PAS un chatbot ni un harness — sauf si ça s'intègre directement dans Claude Code.
6. **Propose-et-valide** pour tout ce qui modifie les skills ciselés à la main.

## Extension de cap (2026-06-16) — la boîte à outils de config

Décision Chris : Arcade devient aussi une **boîte à outils de configuration Claude Code**, ouverte en open-source, utilisable par n'importe qui sur sa propre config dès le téléchargement (Linux/macOS/Windows). Cette extension **sert** le North Star, elle ne le remplace pas : elle est le bras armé de l'organe d'apprentissage.

- **Diagnostic de config** : détecter les mauvais patterns (surchargé, sous-détaillé, non-anglais, sans trigger/description) selon les normes Anthropic. Base déterministe gratuite ; verdict approfondi `claude -p` à la demande.
- **Atelier** (à venir) : rédaction de prompts, création/comparaison de skills — l'intelligence vient de `claude -p` (abonnement Claude Code, zéro API externe), et **réutilise `/prompt-architect`** comme source de vérité, jamais une réimplémentation.
- **Boucle fermée** : les outils consomment les consolidations (créer un skill depuis un champion éprouvé, réécrire un skill jugé faible par la courbe).

Les contraintes dures ci-dessus restent intactes : zéro API externe, tokens uniquement sur action explicite, propose-et-valide pour tout patch de skill ciselé main.

## Ce qu'on ne fait pas

- Pas de dépense de tokens en arrière-plan non sollicitée.
- Pas de système qui *suppose* qu'il aide sans le prouver.
- Pas de régression sous ce North Star.
