import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Message } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { BotAvatar } from "./BotAvatar";
import { blurUp, fadeUp, staggerChildren } from "./motionPresets";

const HEADLINE = "What would you like to know about food?";
const TOPICS = ["Nutrient intakes", "Food storage", "Cooking temperatures", "Healthy eating patterns"];
const AUTHORITIES = ["USDA", "WHO", "EFSA", "NHS Eatwell", "FoodSafety.gov", "NHMRC"];

export function MessageList({
  messages,
  loading,
  hydrated = true,
}: {
  messages: Message[];
  loading: boolean;
  hydrated?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 md:px-8"
      // Fade content at the edges instead of a hard cut where it scrolls under the suggestions
      style={{
        maskImage: "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 2rem), transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 2rem), transparent)",
      }}
      aria-live="polite"
    >
      <div className="relative max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {!hydrated ? null : messages.length === 0 ? (
            <motion.div
              key="empty"
              variants={staggerChildren(0.08)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
              className="min-h-[45vh] sm:min-h-[50vh] flex flex-col items-center justify-center text-center py-6 sm:py-10"
            >
              <motion.div variants={fadeUp} className="relative mb-5 sm:mb-6">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 rounded-3xl bg-emerald-400/40 blur-2xl"
                  animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.9, 1.1, 0.9] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 ring-1 ring-white/25"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
                </motion.div>
              </motion.div>

              {/* Headline reveals word by word */}
              <motion.h2
                variants={staggerChildren(0.07)}
                aria-label={HEADLINE}
                className="text-[1.6rem] leading-tight sm:text-3xl font-semibold tracking-tight max-w-[18ch] sm:max-w-none"
              >
                {HEADLINE.split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    variants={blurUp}
                    className="inline-block mr-[0.25em] last:mr-0 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent"
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h2>

              <motion.p variants={fadeUp} className="mt-3 text-sm text-zinc-400 max-w-md text-pretty leading-relaxed px-2">
                Every answer is grounded in official public health guidelines, with the source document cited for each
                claim.
              </motion.p>

              <motion.div variants={staggerChildren(0.05)} className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                {TOPICS.map((t) => (
                  <motion.span
                    key={t}
                    variants={{
                      hidden: { opacity: 0, scale: 0.8 },
                      show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 20 } },
                    }}
                    whileHover={{ y: -2 }}
                    className="glass-card px-3 py-1 rounded-full text-xs text-zinc-300"
                  >
                    {t}
                  </motion.span>
                ))}
              </motion.div>

              <motion.div variants={fadeUp} className="mt-7 sm:mt-8">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Sources</p>
                <p className="mt-1.5 text-xs text-zinc-400 px-4 leading-relaxed">{AUTHORITIES.join("  ·  ")}</p>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="space-y-5 sm:space-y-6"
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* popLayout takes the indicator out of flow as it exits, so the arriving answer doesn't jump */}
        <AnimatePresence mode="popLayout">
          {loading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              className="flex items-start gap-3 mt-5 sm:mt-6"
              role="status"
            >
              <div className="hidden sm:block">
                <BotAvatar />
              </div>
              <div className="glass-card rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-3">
                <div className="flex items-center gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-300"
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-xs bg-[linear-gradient(90deg,#71717a_0%,#f4f4f5_50%,#71717a_100%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
                  Checking official guidelines…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={endRef} />
      </div>
    </div>
  );
}
