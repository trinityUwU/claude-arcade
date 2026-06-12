// Catalogue des achievements, remappé Hermes → Claude Code.
// IDs STABLES : ils servent de clés d'unlock dans state.json. Ne pas renommer.
import type { Achievement, Tier, TierName } from "../types.ts";

const TIER_NAMES: TierName[] = ["Copper", "Silver", "Gold", "Diamond", "Olympian"];

function t(values: [number, number, number, number, number]): Tier[] {
  return TIER_NAMES.map((name, i) => ({ name, threshold: values[i]! }));
}

/** Fabrique un achievement de façon compacte (params nommés). */
function ach(
  id: string, name: string, category: string, kind: Achievement["kind"],
  icon: string, thresholdMetric: string, tiers: Tier[],
  description: string, secret = false,
): Achievement {
  return { id, name, category, kind, icon, thresholdMetric, tiers, description, secret };
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Agent Autonomy ───────────────────────────────────────────────
  ach("let_him_cook", "Let Him Cook", "Agent Autonomy", "best_session", "flame",
    "max_tool_calls_in_session", t([50, 150, 400, 1000, 2500]),
    "Laisse Claude enchaîner une vraie chaîne d'outils autonome en une session."),
  ach("autonomous_avalanche", "Autonomous Avalanche", "Agent Autonomy", "lifetime", "avalanche",
    "total_tool_calls", t([500, 2000, 6000, 18000, 50000]),
    "Accumule une avalanche d'appels d'outils sur toutes tes sessions."),
  ach("toolchain_maxxer", "Toolchain Maxxer", "Agent Autonomy", "best_session", "nodes",
    "max_distinct_tools_in_session", t([8, 15, 25, 40, 60]),
    "Utilise un large éventail d'outils distincts en une seule session."),
  ach("subagent_commander", "Subagent Commander", "Agent Autonomy", "lifetime", "branch",
    "total_task_calls", t([5, 25, 75, 250, 1000]),
    "Coordonne du travail délégué à des sous-agents."),
  ach("shell_whisperer", "Shell Whisperer", "Agent Autonomy", "lifetime", "terminal",
    "total_bash_calls", t([200, 800, 2500, 8000, 20000]),
    "Pilote le terminal à coups de Bash, encore et encore."),

  // ── Debugging Chaos ──────────────────────────────────────────────
  ach("red_text_connoisseur", "Red Text Connoisseur", "Debugging Chaos", "lifetime", "warning",
    "total_errors", t([100, 400, 1200, 4000, 12000]),
    "Croise assez d'erreurs pour développer un palais pour le texte rouge."),
  ach("actually_read_the_logs", "Actually Read The Logs", "Debugging Chaos", "lifetime", "scroll",
    "log_read_events", t([20, 75, 200, 600, 2000]),
    "Inspecte les logs au lieu de deviner."),
  ach("permission_denied_any_percent", "Permission Denied Any%", "Debugging Chaos", "lifetime", "lock",
    "permission_denied_events", t([5, 20, 60, 200, 600]),
    "Speedrun contre les murs de permissions.", true),
  ach("port_3000_taken", "Port 3000 Is Taken", "Debugging Chaos", "lifetime", "plug",
    "port_conflict_events", t([3, 10, 30, 100, 300]),
    "Découvre les conflits de port jusqu'à l'engourdissement.", true),

  // ── Vibe Coding ──────────────────────────────────────────────────
  ach("one_more_small_change", "One More Small Change", "Vibe Coding", "best_session", "pencil",
    "max_file_edits_in_session", t([20, 60, 150, 400, 1000]),
    "Fais assez d'édits en une session pour invalider l'expression « petit changement »."),
  ach("vibe_architect", "Vibe Architect", "Vibe Coding", "best_session", "blueprint",
    "max_files_touched_in_session", t([15, 40, 100, 250, 600]),
    "Touche une large surface de fichiers en une session."),
  ach("supposed_to_be_quick", "This Was Supposed To Be Quick", "Vibe Coding", "best_session", "melting_clock",
    "max_messages_in_session", t([150, 400, 900, 2000, 5000]),
    "Une petite demande devient une expédition entière."),
  ach("pixel_goblin", "Pixel Goblin", "Vibe Coding", "lifetime", "pixel",
    "frontend_activity", t([50, 200, 600, 1800, 5000]),
    "Frontend, CSS, SVG, tuning visuel soutenu."),

  // ── Claude-Native ────────────────────────────────────────────────
  ach("skillsmith", "Skillsmith", "Claude-Native", "lifetime", "hammer_scroll",
    "skill_invocations", t([10, 40, 120, 400, 1200]),
    "Invoque tes skills assez souvent pour laisser des empreintes."),
  ach("memory_keeper", "Memory Keeper", "Claude-Native", "lifetime", "crystal",
    "memory_writes", t([25, 100, 300, 1000, 3000]),
    "Persiste du savoir durable via la mémoire sémantique."),
  ach("codeindex_cartographer", "CodeIndex Cartographer", "Claude-Native", "lifetime", "map",
    "codeindex_queries", t([20, 80, 250, 800, 2500]),
    "Cartographie le code par requêtes sémantiques au lieu de grep à l'aveugle."),
  ach("mcp_polyglot", "MCP Polyglot", "Claude-Native", "lifetime", "antenna",
    "mcp_diversity", t([3, 6, 9, 13, 18]),
    "Touche un large éventail de serveurs MCP distincts."),

  // ── Research ──────────────────────────────────────────────────────
  ach("rabbit_hole_certified", "Rabbit Hole Certified", "Research", "lifetime", "compass",
    "web_searches", t([20, 80, 250, 800, 2500]),
    "Recherche web et extraction de docs en pagaille."),
  ach("browser_automaton", "Browser Automaton", "Research", "lifetime", "robot",
    "browser_actions", t([15, 60, 200, 700, 2000]),
    "Pilote le navigateur via Playwright comme un humain."),

  // ── Model Lore ────────────────────────────────────────────────────
  ach("claude_confidant", "Claude Confidant", "Model Lore", "lifetime", "owl",
    "opus_sessions", t([5, 25, 75, 250, 750]),
    "Sessions menées avec Opus."),
  ach("open_weights_pilgrim", "Open Weights Pilgrim", "Model Lore", "lifetime", "server",
    "local_model_sessions", t([1, 5, 20, 60, 200]),
    "Discute avec des modèles locaux / open-weight (EchoHub)."),
  ach("model_polyglot", "Model Polyglot", "Model Lore", "lifetime", "prism",
    "model_diversity", t([2, 3, 4, 5, 6]),
    "Fais tourner une vraie variété de modèles."),

  // ── Lifestyle ─────────────────────────────────────────────────────
  ach("marathon_operator", "Marathon Operator", "Lifestyle", "lifetime", "marathon",
    "session_count", t([25, 100, 300, 800, 2000]),
    "Accumule un nombre sérieux de sessions."),
  ach("weekend_warrior", "Weekend Warrior", "Lifestyle", "lifetime", "calendar",
    "weekend_sessions", t([10, 40, 120, 350, 900]),
    "Code le week-end au point d'en faire un mode de vie."),
  ach("night_shift_operator", "Night Shift Operator", "Lifestyle", "lifetime", "moon",
    "night_sessions", t([10, 40, 120, 350, 900]),
    "Sessions aux heures gremlin (0h–6h)."),

  // ── Self-Improvement (propre à Chris, absent de Hermes) ──────────
  ach("self_improver", "Self-Improver", "Self-Improvement", "lifetime", "loop",
    "loop_runs", t([1, 10, 50, 200, 1000]),
    "Laisse la boucle d'auto-amélioration relire tes sessions."),
  ach("skill_issue_skill_created", "Skill Issue? Skill Created.", "Self-Improvement", "lifetime", "anvil",
    "skills_patched", t([3, 15, 50, 150, 500]),
    "Crée ou patche des procédures durables au lieu de te répéter."),
  ach("wisdom_harvester", "Wisdom Harvester", "Self-Improvement", "lifetime", "wheat",
    "learnings_merged", t([5, 25, 75, 250, 800]),
    "Valide et fusionne les learnings proposés par la boucle."),
];
