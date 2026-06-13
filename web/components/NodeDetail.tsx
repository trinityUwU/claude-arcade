import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { GraphNode } from "../../src/consolidate/types.ts";
import { SessionDetail } from "./SessionDetail.tsx";

interface Props { node: GraphNode; onClose: () => void }

const TYPE_LABEL: Record<string, string> = {
  session: "Session", project: "Projet", notion: "Notion", error: "Erreur récurrente", process: "Process gagnant",
};

function MetaDetail({ node }: { node: GraphNode }): React.JSX.Element {
  const m = node.meta ?? {};
  const rows = Object.entries(m).filter(([k]) => k !== "file");
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-white/[0.05] pb-1.5">
          <dt className="text-[12px] text-white/40">{k}</dt>
          <dd className="text-right text-[12.5px] text-white/75">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
      {!rows.length && <p className="text-sm text-white/40">Nœud de type « {node.type} » — relié dans le réseau.</p>}
    </dl>
  );
}

export function NodeDetail({ node, onClose }: Props): React.JSX.Element {
  const isSession = node.type === "session";
  const sessionId = node.id.startsWith("sess:") ? node.id.slice(5) : "";
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute right-0 top-0 z-20 flex h-full w-[380px] flex-col border-l border-white/[0.08]
        bg-[#0d0c15]/95 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/70">
            {TYPE_LABEL[node.type] ?? node.type}
          </div>
          <h3 className="mt-0.5 text-[15px] font-bold leading-tight text-white/90">{node.label}</h3>
        </div>
        <button onClick={onClose} className="text-white/40 transition hover:text-white/80"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isSession && sessionId ? <SessionDetail id={sessionId} /> : <MetaDetail node={node} />}
      </div>
    </motion.div>
  );
}
