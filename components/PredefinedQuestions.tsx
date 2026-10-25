"use client";

import { motion } from "motion/react";
import { fadeUp, staggerChildren } from "./motionPresets";

interface PredefinedQuestionsProps {
  onSelect: (question: string) => void;
  onClose: () => void;
}

const PREDEFINED_QUESTIONS = [
  {
    category: "Nutrient requirements",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
    ),
    accent: "text-emerald-300 bg-emerald-400/10",
    question: "How much protein does an adult need per day?",
  },
  {
    category: "Food safety and storage",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    ),
    accent: "text-cyan-300 bg-cyan-400/10",
    question: "How long can cooked chicken stay in the fridge?",
  },
  {
    category: "Cooking methods",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c2-2.96 0-7-1-8 0 3.03-2 4-2 6s2 3 3 2Z"/><path d="M7 16c2.5-3.5 0-8.5-1-9.5 0 3.7-2.5 5-2.5 7.5 0 2.5 2 3.5 3.5 2Z"/><path d="M17 14c2.5-3.5 0-8.5-1-9.5 0 3.7-2.5 5-2.5 7.5 0 2.5 2 3.5 3.5 2Z"/></svg>
    ),
    accent: "text-amber-300 bg-amber-400/10",
    question: "What internal temperature should poultry be cooked to?",
  },
];

export function PredefinedQuestions({ onSelect, onClose }: PredefinedQuestionsProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="overflow-hidden flex-shrink-0"
    >
      <div className="px-2.5 sm:px-3 md:px-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2 px-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-400">
              Try asking
            </span>
            <motion.button
              whileTap={{ scale: 0.85, rotate: 90 }}
              onClick={onClose}
              title="Dismiss suggestions"
              aria-label="Dismiss suggestions"
              className="text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.07] p-1.5 sm:p-1 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </motion.button>
          </div>

          {/* Swipeable row on phones, three-column grid from sm up */}
          <motion.div
            variants={staggerChildren(0.07, 0.1)}
            initial="hidden"
            animate="show"
            className="no-scrollbar flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-2.5 px-2.5 pt-1 pb-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible"
          >
            {PREDEFINED_QUESTIONS.map((item, idx) => (
              <motion.button
                key={idx}
                variants={fadeUp}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(item.question)}
                className="glass-card group w-[72%] flex-shrink-0 snap-start sm:w-auto flex flex-col text-left p-3 rounded-xl hover:bg-white/[0.07] hover:border-white/[0.14] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                <span className={`inline-flex self-start items-center gap-1 px-1.5 py-0.5 mb-1.5 rounded-md text-[10px] font-medium ${item.accent}`}>
                  {item.icon}
                  <span>{item.category}</span>
                </span>
                <span className="text-xs text-zinc-300 group-hover:text-white font-medium line-clamp-2 leading-snug">
                  {item.question}
                </span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
