"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Message, Citation, Claim } from "@/types/chat";
import { BotAvatar } from "./BotAvatar";
import { fadeUp, hoverLift, softSpring, staggerChildren } from "./motionPresets";

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

export function MessageBubble({ message }: { message: Message }) {
  const [showClaims, setShowClaims] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const validClaims = (!isUser && message.claims)
    ? message.claims.filter(
        (c) => c && c.claim_text && c.source && c.source.document_name && c.source.document_name.trim().length > 0
      )
    : [];

  const sources = deduplicateSources(validClaims);

  // Split content and disclaimer if present
  let mainContent = message.content;
  let disclaimerText: string | null = null;

  const disclaimerMatch = message.content.match(/(?:(?:\*+)?Disclaimer(?:\*+)?:?\s*)([\s\S]+)$/i);
  if (disclaimerMatch) {
    mainContent = message.content.substring(0, disclaimerMatch.index).trim();
    disclaimerText = disclaimerMatch[1].replace(/^\*+|\*+$/g, "").trim();
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context); nothing to do
    }
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        transition={softSpring}
        style={{ transformOrigin: "bottom right" }}
        className="flex justify-end"
      >
        <div className="max-w-[88%] sm:max-w-[75%] rounded-2xl rounded-tr-md bg-gradient-to-br from-emerald-400/90 to-teal-600/90 px-4 py-2.5 text-[15px] sm:text-sm text-white leading-relaxed break-words shadow-lg shadow-emerald-900/40 ring-1 ring-inset ring-white/20">
          {message.content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={softSpring}
      className="group flex items-start gap-3"
    >
      <motion.div
        className="hidden sm:block"
        initial={{ scale: 0.5, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        <BotAvatar />
      </motion.div>

      <div className="min-w-0 flex-1 sm:max-w-[calc(100%-2.75rem)]">
        <div className="glass-card rounded-2xl rounded-tl-md px-4 py-3.5 md:px-5 md:py-4 text-[15px] sm:text-sm leading-relaxed space-y-3.5">
          <p className="whitespace-pre-line break-words text-zinc-100">{mainContent}</p>

          {disclaimerText && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...softSpring, delay: 0.12 }}
              className="px-3 py-2.5 rounded-xl bg-amber-400/[0.07] ring-1 ring-inset ring-amber-300/20 text-amber-100/85 text-xs flex items-start gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300 flex-shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p className="leading-relaxed">
                <span className="font-semibold text-amber-200">Disclaimer: </span>
                {disclaimerText}
              </p>
            </motion.div>
          )}

          {sources.length > 0 && (
            <div className="pt-3 border-t border-white/[0.07] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-[11px] uppercase tracking-[0.1em]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17L12 22l10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/></svg>
                  <span>Sources ({sources.length})</span>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowClaims(!showClaims)}
                  aria-expanded={showClaims}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.08] transition-colors"
                >
                  <span className="tabular-nums">
                    {validClaims.length} verified {validClaims.length === 1 ? "statement" : "statements"}
                  </span>
                  <motion.svg
                    animate={{ rotate: showClaims ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </motion.svg>
                </motion.button>
              </div>

              <motion.div
                variants={staggerChildren(0.07, 0.15)}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                {sources.map((src, idx) => (
                  <motion.a
                    key={`${src.document_name}|${src.section}`}
                    variants={fadeUp}
                    whileHover={hoverLift}
                    whileTap={{ scale: 0.98 }}
                    href={src.url && src.url !== "https://example.com/nutrition" ? src.url : `/api/documents?name=${encodeURIComponent(src.document_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/src flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-black/20 hover:bg-emerald-400/[0.06] ring-1 ring-inset ring-white/[0.06] hover:ring-emerald-300/25 transition-colors"
                  >
                    <span className="mt-0.5 w-6 h-6 flex-shrink-0 rounded-lg bg-emerald-400/10 text-emerald-300 flex items-center justify-center text-[10px] font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-100 line-clamp-2">{src.document_name}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-zinc-500 group-hover/src:text-emerald-300 group-hover/src:translate-x-0.5 group-hover/src:-translate-y-0.5 transition-all"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                      </span>
                      <span className="block text-[11px] text-zinc-400 mt-0.5 truncate">
                        {[src.publisher, src.year, src.section].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </motion.a>
                ))}
              </motion.div>

              <AnimatePresence initial={false}>
                {showClaims && (
                  <motion.div
                    key="claims"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <motion.div variants={staggerChildren(0.05)} initial="hidden" animate="show" className="pt-2 space-y-1.5">
                      {validClaims.map((claim, idx) => (
                        <motion.div
                          key={idx}
                          variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                          className="rounded-xl bg-black/20 border-l-2 border-emerald-400/50 px-3 py-2 text-xs space-y-1"
                        >
                          <p className="text-zinc-200 leading-normal">“{claim.claim_text}”</p>
                          {claim.source && (
                            <p className="text-[10px] text-emerald-300/85 font-medium">
                              {claim.source.document_name}
                              {claim.source.section ? ` · ${claim.source.section}` : ""}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={handleCopy}
            aria-label="Copy answer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "done" : "copy"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="inline-flex"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300"><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                )}
              </motion.span>
            </AnimatePresence>
            <span>{copied ? "Copied" : "Copy"}</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
