import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode, GraphHealth } from "../../src/consolidate/types.ts";
import { NodeDetail } from "./NodeDetail.tsx";

type ForceNode = GraphNode & { x?: number; y?: number };

const HEALTH_COLOR: Record<GraphHealth, string> = {
  strong: "#34d399", weak: "#fb7185", watch: "#fbbf24", neutral: "#7c83a3",
};
const GLYPH: Record<string, string> = {
  project: "▣", notion: "◇", error: "△", process: "★", session: "",
};

/** Mesure la taille du conteneur (ForceGraph2D exige width/height explicites). */
function useSize(): [React.RefObject<HTMLDivElement | null>, { w: number; h: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

function drawNode(node: ForceNode, ctx: CanvasRenderingContext2D, scale: number, selectedId: string): void {
  const r = Math.max(2.2, Math.sqrt(node.weight) * 1.7);
  ctx.beginPath();
  ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
  ctx.fillStyle = HEALTH_COLOR[node.health];
  ctx.globalAlpha = node.type === "session" ? 0.8 : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (node.id === selectedId) {
    ctx.lineWidth = 2.4 / scale;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  // Labels permanents pour les nœuds-clés (peu nombreux) ; les sessions restent au survol.
  if (node.type !== "session") {
    ctx.font = `${11 / scale}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = "rgba(231,229,240,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${GLYPH[node.type]} ${node.label}`.slice(0, 26), node.x ?? 0, (node.y ?? 0) + r + 2 / scale);
  }
}

function tooltip(n: GraphNode): string {
  const q = n.meta?.quality ?? n.meta?.avgQuality;
  const extra = typeof q === "number" ? ` · qualité ${q}` : n.meta?.count ? ` · ×${n.meta.count}` : "";
  return `<div style="font:12px Space Grotesk,sans-serif;color:#e7e5f0;background:#15131f;
    padding:6px 9px;border:1px solid #2a2740;border-radius:8px;max-width:280px">
    <b>${n.type}</b> — ${n.label}${extra}</div>`;
}

export function BrainGraph(): React.JSX.Element {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [ref, size] = useSize();

  useEffect(() => {
    fetch("/api/graph").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);

  const graphData = useMemo(
    () => ({ nodes: (data?.nodes ?? []) as ForceNode[], links: data?.edges ?? [] }),
    [data],
  );
  const selectedId = selected?.id ?? "";

  return (
    <div ref={ref} className="relative h-full w-full">
      {data && data.nodes.length > 0 ? (
        <ForceGraph2D
          width={size.w} height={size.h}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          nodeLabel={(n) => tooltip(n as GraphNode)}
          nodeCanvasObject={(n, ctx, scale) => drawNode(n as ForceNode, ctx, scale, selectedId)}
          onNodeClick={(n) => setSelected(n as GraphNode)}
          onBackgroundClick={() => setSelected(null)}
          linkColor={() => "rgba(167,139,250,0.14)"}
          linkWidth={0.6}
          linkDirectionalParticles={0}
          cooldownTicks={120}
          warmupTicks={40}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          {data ? "Graphe vide — lance une consolidation pour peupler le réseau." : "Chargement du cerveau…"}
        </div>
      )}
      <Legend />
      <TypeHint />
      <AnimatePresence>
        {selected && <NodeDetail key={selected.id} node={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

/** Rappel des types de nœuds (en plus de la légende santé) — aide à la compréhension. */
function TypeHint(): React.JSX.Element {
  const items = [
    ["▣", "Projet"], ["◇", "Notion"], ["★", "Process gagnant"],
    ["△", "Erreur récurrente"], ["•", "Session"],
  ];
  return (
    <div className="absolute right-4 top-4 flex flex-col gap-1 rounded-xl border border-white/[0.08]
      bg-black/40 px-3 py-2.5 text-[11px] text-white/55 backdrop-blur-md">
      <span className="mb-0.5 text-[10px] uppercase tracking-widest text-white/30">Types · clique un nœud</span>
      {items.map(([g, l]) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-3 text-center text-white/70">{g}</span>{l}
        </div>
      ))}
    </div>
  );
}

function Legend(): React.JSX.Element {
  const items: Array<[GraphHealth, string]> = [
    ["strong", "Fort / sain"], ["weak", "Faible / à retravailler"],
    ["watch", "À surveiller"], ["neutral", "Neutre"],
  ];
  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded-xl border border-white/[0.08]
      bg-black/40 px-3 py-2.5 backdrop-blur-md">
      {items.map(([h, label]) => (
        <div key={h} className="flex items-center gap-2 text-[11px] text-white/55">
          <span className="size-2.5 rounded-full" style={{ background: HEALTH_COLOR[h] }} />
          {label}
        </div>
      ))}
    </div>
  );
}
