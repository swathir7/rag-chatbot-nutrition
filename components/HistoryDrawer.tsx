"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { softSpring, spring } from "./motionPresets";

export interface SessionItem {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionItem[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export function HistoryDrawer({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAll,
}: HistoryDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="history" className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Chat history">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer (swipe left to close on touch) */}
          <motion.div
            initial={{ x: "-105%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-105%", opacity: 0.6 }}
            transition={spring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.6, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -100 || info.velocity.x < -450) onClose();
            }}
            className="glass-strong relative m-2 sm:m-3 w-full max-w-[calc(100%-1rem)] sm:max-w-md rounded-2xl flex flex-col z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Chat History</h2>
                  <p className="text-[11px] text-zinc-400">
                    {sessions.length} saved {sessions.length === 1 ? "conversation" : "conversations"} (max 150)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    onNewChat();
                    onClose();
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 ring-1 ring-inset ring-emerald-300/20 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  <span>New</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.85, rotate: 90 }}
                  onClick={onClose}
                  aria-label="Close history"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.07] rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </motion.button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2">
              {sessions.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                  <p className="text-sm font-medium text-zinc-300">No chat history yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Start asking nutrition questions to see conversations here.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {sessions.map((s, i) => {
                    const isActive = s.id === currentSessionId;
                    return (
                      <motion.div
                        key={s.id}
                        layout="position"
                        initial={{ opacity: 0, x: -16 }}
                        // Cap the stagger so long histories don't take seconds to finish
                        animate={{ opacity: 1, x: 0, transition: { ...softSpring, delay: 0.08 + Math.min(i, 12) * 0.03 } }}
                        exit={{ opacity: 0, x: -30, height: 0, marginTop: 0, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.98 }}
                        className={`group relative rounded-xl border p-3 cursor-pointer transition-colors ${
                          isActive
                            ? "bg-emerald-400/[0.09] border-emerald-400/25"
                            : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
                        }`}
                        onClick={() => {
                          onSelectSession(s.id);
                          onClose();
                        }}
                      >
                        <div className="flex items-start justify-between pr-6">
                          <p className={`text-xs font-medium leading-snug line-clamp-2 ${isActive ? "text-emerald-100" : "text-zinc-200"}`}>
                            {s.title}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 mt-2 text-[10px] text-zinc-500">
                          <span>{formatDate(s.created_at)}</span>
                          <span>•</span>
                          <span>{s.message_count} {s.message_count === 1 ? "msg" : "msgs"}</span>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(s.id);
                          }}
                          title="Delete chat"
                          aria-label={`Delete chat: ${s.title}`}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 text-zinc-500 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {sessions.length > 0 && (
              <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/[0.06] flex justify-end">
                <button
                  onClick={() => {
                    if (confirm("Clear all chat history?")) {
                      onClearAll();
                    }
                  }}
                  className="text-xs text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Clear History</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
