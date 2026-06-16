// Langue de motion unique de l'app (principes motion-design : une seule logique directionnelle,
// courbes nommées, reveal blur-over-opacity). Réutilisé partout pour la cohérence.
import type { Variants, Transition, TargetAndTransition } from "framer-motion";

// Courbes nommées (cubic-bezier) — la personnalité du mouvement. Jamais l'ease par défaut.
export const EASE = {
  silk: [0.22, 1, 0.36, 1] as const,   // entrées : décélération douce
  snap: [0.4, 0, 0.2, 1] as const,     // transitions UI rapides
} as const;

// État de repos commun : identique en mode animé ET silencieux. Crucial — ne JAMAIS
// changer `animate`/`transition` selon `silent`, sinon un refresh SSE en cours de route
// coupe l'animation d'entrée (snap). Seul `initial` distingue les deux modes.
const REST: TargetAndTransition = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };

/** Reveal canonique : montée franche + blur + léger scale. `silent` → pas d'entrée (apparition nette). */
export function reveal(silent: boolean, index = 0): {
  initial: false | TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
} {
  return {
    initial: silent ? false : { opacity: 0, y: 22, scale: 0.97, filter: "blur(8px)" },
    animate: REST,
    transition: { duration: 0.5, ease: EASE.silk, delay: silent ? 0 : Math.min(index * 0.045, 0.5) },
  };
}

/** Micro-interaction de carte : légère élévation au survol (langue de motion cohérente). */
export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.2, ease: EASE.snap } },
} as const;

/** Variants conteneur/enfant pour un stagger d'une liste (filtrage, refresh navigation). */
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};
export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE.silk } },
};
