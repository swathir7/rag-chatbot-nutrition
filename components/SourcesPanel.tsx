import { Claim, Citation } from "@/types/chat";
import { AnimatePresence, motion } from "motion/react";
import { SourceCard } from "./SourceCard";

function deduplicateSources(claims: Claim[]): Citation[] {
  const unique = new Map<string, Citation>();
  for (const claim of claims) {
    if (claim.source && claim.source.document_name) {
      const key = `${claim.source.document_name}|${claim.source.section || ""}`;
      if (!unique.has(key)) {
        unique.set(key, claim.source);
      }
    }
  }
  return Array.from(unique.values());
}

export function SourcesPanel({ claims, onClose }: { claims: Claim[]; onClose?: () => void }) {
  const uniqueSources = deduplicateSources(claims || []);

  return (
    <div className="flex flex-col h-full min-h-0 text-zinc-100">
      <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17L12 22l10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/></svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Chat sources</h2>
            <p className="text-[11px] text-zinc-400">Guidance cited in this chat</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.span
            key={uniqueSources.length}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 ring-1 ring-inset ring-white/10 tabular-nums"
          >
            {uniqueSources.length}
          </motion.span>
          {onClose && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onClose}
              aria-label="Close sources"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </motion.button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {uniqueSources.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center p-6"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center mb-3 text-zinc-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="m14 17-2.83-2.83"/></svg>
            </motion.div>
            <p className="text-sm font-medium text-zinc-200 mb-1">No sources yet</p>
            <p className="text-xs text-zinc-500 max-w-[220px] leading-relaxed">
              Documents cited in this conversation collect here, so you can open and check them.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {uniqueSources.map((source, idx) => (
              <SourceCard key={`${source.document_name}|${source.section}`} source={source} index={idx + 1} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
