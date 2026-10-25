import { forwardRef } from "react";
import { motion } from "motion/react";
import { Citation } from "@/types/chat";
import { softSpring } from "./motionPresets";

// forwardRef so AnimatePresence's popLayout mode can measure the card as it leaves.
export const SourceCard = forwardRef<HTMLDivElement, { source: Citation; index?: number }>(function SourceCard(
  { source, index },
  ref
) {
  const targetUrl =
    source.url && source.url !== "https://example.com/nutrition"
      ? source.url
      : `/api/documents?name=${encodeURIComponent(source.document_name)}`;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...softSpring, delay: (index ?? 0) * 0.06 } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      whileHover={{ y: -2 }}
      className="glass-card group rounded-xl p-3.5 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-start gap-2.5">
        {index !== undefined && (
          <span className="mt-0.5 w-6 h-6 flex-shrink-0 rounded-lg bg-emerald-400/10 text-emerald-300 flex items-center justify-center text-[10px] font-semibold tabular-nums">
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-white leading-snug">{source.document_name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {source.publisher && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-300">{source.publisher}</span>
            )}
            {source.year ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 font-mono tabular-nums">{source.year}</span>
            ) : null}
          </div>
          {source.section && (
            <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2">
              <span className="text-zinc-500">Section: </span>
              {source.section}
            </p>
          )}
        </div>
      </div>

      <motion.a
        whileTap={{ scale: 0.97 }}
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link mt-3 flex items-center justify-center gap-1.5 w-full py-2 sm:py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-400/[0.07] hover:bg-emerald-400/[0.14] ring-1 ring-inset ring-emerald-300/15 transition-colors"
      >
        <span>Open document</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
      </motion.a>
    </motion.div>
  );
});
