// Agrégation des sessions analysées en un agrégat plat (clé = threshold_metric).
import type { SessionStats, Aggregate } from "../types.ts";
import { modelFamily, isLocalModel } from "./tool-classify.ts";

/** Compteurs cumulés sur toute la vie (sommés). */
const LIFETIME_KEYS = [
  "total_tool_calls", "total_bash_calls", "total_task_calls", "total_errors",
  "total_file_edits", "skill_invocations", "web_searches", "memory_writes",
  "codeindex_queries", "browser_actions", "log_read_events",
  "permission_denied_events", "port_conflict_events", "frontend_activity",
] as const;

function max(agg: Aggregate, key: string, value: number): void {
  if (value > (agg[key] ?? 0)) agg[key] = value;
}

function applyMeta(agg: Aggregate, s: SessionStats, models: Set<string>, mcp: Set<string>): void {
  const m = s.meta;
  agg.session_count = (agg.session_count ?? 0) + 1;
  if (m.isNight) agg.night_sessions = (agg.night_sessions ?? 0) + 1;
  if (m.isWeekend) agg.weekend_sessions = (agg.weekend_sessions ?? 0) + 1;
  if (m.models.some(isLocalModel)) agg.local_model_sessions = (agg.local_model_sessions ?? 0) + 1;
  for (const family of new Set(m.models.map(modelFamily))) {
    if (family) agg[`${family}_sessions`] = (agg[`${family}_sessions`] ?? 0) + 1;
  }
  for (const model of m.models) models.add(model);
  for (const server of m.mcpServers) mcp.add(server);
}

function applyMaxima(agg: Aggregate, s: SessionStats): void {
  const c = s.counters;
  max(agg, "max_tool_calls_in_session", c.total_tool_calls ?? 0);
  max(agg, "max_file_edits_in_session", c.total_file_edits ?? 0);
  max(agg, "max_files_touched_in_session", c.max_files_touched_in_session ?? 0);
  max(agg, "max_distinct_tools_in_session", s.meta.distinctTools);
  max(agg, "max_messages_in_session", s.meta.messageCount);
}

/** Combine les sessions + métriques injectées (état de la boucle, phase 3). */
export function aggregate(sessions: SessionStats[], extra: Aggregate = {}): Aggregate {
  const agg: Aggregate = {};
  const models = new Set<string>(), mcp = new Set<string>();
  for (const key of LIFETIME_KEYS) agg[key] = 0;
  for (const s of sessions) {
    for (const key of LIFETIME_KEYS) agg[key] = (agg[key] ?? 0) + (s.counters[key] ?? 0);
    applyMaxima(agg, s);
    applyMeta(agg, s, models, mcp);
  }
  agg.model_diversity = models.size;
  agg.mcp_diversity = mcp.size;
  agg.loop_runs = extra.loop_runs ?? 0;
  agg.skills_patched = extra.skills_patched ?? 0;
  agg.learnings_merged = extra.learnings_merged ?? 0;
  return agg;
}
