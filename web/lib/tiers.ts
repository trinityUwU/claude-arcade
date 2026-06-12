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

const ICONS: Record<string, string> = {
  flame: "🔥", avalanche: "🏔️", nodes: "🕸️", branch: "🌿", terminal: "⌨️",
  warning: "⚠️", scroll: "📜", lock: "🔒", plug: "🔌", pencil: "✏️",
  blueprint: "📐", melting_clock: "🫠", pixel: "🎨", hammer_scroll: "🛠️",
  crystal: "🔮", map: "🗺️", antenna: "📡", compass: "🧭", robot: "🤖",
  owl: "🦉", server: "🖥️", prism: "🔱", marathon: "🏃", calendar: "📅",
  moon: "🌙", loop: "♾️", anvil: "⚒️", wheat: "🌾",
};

export function iconFor(name: string): string {
  return ICONS[name] ?? "🏅";
}
