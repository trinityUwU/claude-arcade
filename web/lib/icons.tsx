// Mapping des icônes : noms du catalogue + catégories → composants Lucide (zéro emoji).
import {
  Flame, Mountain, Network, GitBranch, Terminal, TriangleAlert, ScrollText, Lock,
  Plug, Pencil, PencilRuler, Hourglass, Palette, Hammer, Gem, Map, RadioTower,
  Compass, Bot, Bird, Server, Triangle, Footprints, CalendarDays, Moon, Infinity,
  Anvil, Wheat, HelpCircle, Bug, Code, Sparkles, Telescope, Brain, Coffee, TrendingUp,
  type LucideIcon,
} from "lucide-react";

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  flame: Flame, avalanche: Mountain, nodes: Network, branch: GitBranch, terminal: Terminal,
  warning: TriangleAlert, scroll: ScrollText, lock: Lock, plug: Plug, pencil: Pencil,
  blueprint: PencilRuler, melting_clock: Hourglass, pixel: Palette, hammer_scroll: Hammer,
  crystal: Gem, map: Map, antenna: RadioTower, compass: Compass, robot: Bot, owl: Bird,
  server: Server, prism: Triangle, marathon: Footprints, calendar: CalendarDays, moon: Moon,
  loop: Infinity, anvil: Anvil, wheat: Wheat,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Agent Autonomy": Bot,
  "Debugging Chaos": Bug,
  "Vibe Coding": Code,
  "Claude-Native": Sparkles,
  "Research": Telescope,
  "Model Lore": Brain,
  "Lifestyle": Coffee,
  "Self-Improvement": TrendingUp,
};

export function achievementIcon(name: string): LucideIcon {
  return ACHIEVEMENT_ICONS[name] ?? HelpCircle;
}

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Sparkles;
}
