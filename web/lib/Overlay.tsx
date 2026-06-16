// Modale plein écran portalée vers <body> (échappe au transform/filter des cartes,
// sinon le position:fixed se cadre sur la carte). Partagée par Diagnostic + Historique.
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export function Overlay(
  { title, onClose, children, headerExtra }:
  { title: string; onClose: () => void; children: React.ReactNode; headerExtra?: React.ReactNode },
): React.JSX.Element {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.24 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c10]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <span className="truncate font-mono text-[13px] text-white/85">{title}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerExtra}
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}
