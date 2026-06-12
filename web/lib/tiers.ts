// Helpers d'affichage : couleurs de tier, classes de halo, icônes (emoji, zéro dépendance réseau).
import type { TierName } from "../../src/types.ts";

export const TIER_COLOR: Record<TierName, string> = {
  Copper: "text-copper",
  Silver: "text-silver",
  Gold: "text-gold",
  Diamond: "text-diamond",
  Olympian: "text-olympian",
};

export const TIER_GLOW: Record<TierName, string> = {
  Copper: "tier-glow-copper",
  Silver: "tier-glow-silver",
  Gold: "tier-glow-gold",
  Diamond: "tier-glow-diamond",
  Olympian: "tier-glow-olympian",
};
