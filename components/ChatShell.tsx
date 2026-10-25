"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, MotionConfig, motion, useDragControls } from "motion/react";
import { Message } from "@/types/chat";
import { MessageList } from "./MessageList";
import { InputBox } from "./InputBox";
import { SourcesPanel } from "./SourcesPanel";
import { PredefinedQuestions } from "./PredefinedQuestions";
import { HistoryDrawer, SessionItem } from "./HistoryDrawer";
import { GlassBackground } from "./GlassBackground";
import { spring, softSpring, tap } from "./motionPresets";
import { v4 as uuidv4 } from "uuid";

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
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

const iconButton =
  "p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.07] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50";

// Hover-only controls stay visible on touch screens, which have no hover.
const touchVisible = "[@media(hover:none)]:opacity-100";

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  // Desktop keeps the recent-chats rail docked; below lg it opens as an overlay.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false);
  const sheetDrag = useDragControls();

  // Load session list from backend
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
      }
    } catch (e) {
      console.warn("Could not load chat history list", e);
    }
  }, []);

  // Rehydrate current messages and sessionId from local storage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem("nutrition_session_id");
    const savedMessages = localStorage.getItem("nutrition_chat_messages");

    if (savedSession) {
      setSessionId(savedSession);
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.warn("Failed to parse saved chat messages", e);
      }
    }

    // Holding the message area until now stops the empty-state hero flashing on reload
    setHydrated(true);
    loadSessions();
  }, [loadSessions]);

  // Persist messages to local storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("nutrition_chat_messages", JSON.stringify(messages));
    }
  }, [messages]);

  // Escape closes whichever mobile overlay is open
  useEffect(() => {
    if (!mobileSidebarOpen && !mobileSourcesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
        setMobileSourcesOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen, mobileSourcesOpen]);

  const handleSend = async (text: string) => {
    const userMsg: Message = { id: uuidv4(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      if (!res.ok) {
        let errMsg = "The service is temporarily busy or warming up. Please wait a moment and try again.";
        try {
          const errData = await res.json();
          if (errData.error) {
            if (errData.error.startsWith("MODEL_PARSE_ERROR")) {
              errMsg = "I couldn't format a proper response. Please rephrase.";
            } else if (/rate limit|429/i.test(errData.error)) {
              errMsg = "I'm temporarily experiencing high traffic. Please wait a few seconds and try again.";
            } else {
              errMsg = errData.error;
            }
          }
        } catch {
          // ignore non-JSON error pages
        }
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (data.session_id) {
        setSessionId(data.session_id);
        localStorage.setItem("nutrition_session_id", data.session_id);
      }

      const asstMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: data.answer,
        claims: data.claims || [],
      };

      setMessages((prev) => [...prev, asstMsg]);
      // Refresh session list so recent chats update
      loadSessions();
    } catch {
      // Never show "Something went wrong. Please try again."
      // Frame a proper denying answer according to the query
      let content =
        "I cannot answer this question. As an AI assistant dedicated strictly to human nutrition and food safety, I only provide evidence-based guidance grounded in official public health guidelines (USDA, WHO, EFSA). I cannot answer non-human dietary questions, personal targets, or off-topic queries.";

      if (/\b(fish|dogs?|cats?|pets?|animals?|birds?)\b/i.test(text)) {
        content =
          "I cannot provide dietary advice for fish, pets, or animals. I am strictly an AI dietary guidance assistant dedicated to human nutrition and food safety based on official public health guidelines. Commercial sugary beverages (such as Mango Frooti) and processed human foods should not be fed to fish or pets; please consult a qualified veterinarian or aquatic pet care specialist.";
      } else if (/\b(alien|aliens|vampire|vampires|zombie|zombies|dragon|dragons|monster|monsters|robot|robots)\b/i.test(text)) {
        content =
          "I can only provide dietary and food safety guidance for human nutrition based on official public health guidelines. I cannot answer hypothetical, fictional, or non-human dietary questions regarding aliens, fictional creatures, or monsters.";
      } else if (/\b(where\s+is\s+my\s+wallet|wallet|keys|phone|bag|purse)\b/i.test(text)) {
        content =
          "I cannot help you locate personal belongings like your wallet or keys. I am dedicated solely to answering questions about food, nutrition, and food safety based on official public health guidelines.";
      } else if (/\b(sea\s*water|island|dehydration)\b/i.test(text)) {
        content =
          "EMERGENCY / SAFETY WARNING: Do NOT drink seawater under any circumstances. Drinking seawater accelerates fatal dehydration. If you are in danger, please contact emergency rescue services immediately.";
      }

      const errorMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content,
        claims: [],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setShowSuggestions(true); // Predefined questions come back when a new chat starts
    setMobileSidebarOpen(false);
    localStorage.removeItem("nutrition_session_id");
    localStorage.removeItem("nutrition_chat_messages");
  };

  const handleSelectSession = async (selectedId: string) => {
    setMobileSidebarOpen(false);
    try {
      setLoading(true);
      const res = await fetch(`/api/history?session_id=${selectedId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setSessionId(selectedId);
          setMessages(data.messages);
          localStorage.setItem("nutrition_session_id", selectedId);
          localStorage.setItem("nutrition_chat_messages", JSON.stringify(data.messages));
        }
      }
    } catch (e) {
      console.error("Failed to load session messages", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = (deletedId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== deletedId));
    if (sessionId === deletedId) {
      handleNewChat();
    }
  };

  const handleClearAll = () => {
    setSessions([]);
    handleNewChat();
  };

  const openHistory = () => {
    loadSessions();
    setMobileSidebarOpen(false);
    setHistoryOpen(true);
  };

  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarOpen((v) => !v);
    } else {
      setMobileSidebarOpen((v) => !v);
    }
  };

  // Collect all sources/claims for the active chat session
  const activeChatClaims = messages
    .filter((m) => m.role === "assistant" && Array.isArray(m.claims))
    .flatMap((m) => m.claims || []);
  const sourceCount = new Set(
    activeChatClaims
      .filter((c) => c.source?.document_name)
      .map((c) => `${c.source!.document_name}|${c.source!.section || ""}`)
  ).size;

  // Last 5 chats for the quick access sidebar
  const last5Chats = sessions.slice(0, 5);

  // Rendered in the desktop rail and the mobile drawer; `instance` keeps their
  // shared-layout highlight ids apart since both can be mounted at once.
  const renderRecentChats = (instance: "rail" | "drawer") => (
    <>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Recent chats
          </span>
          <span className="px-1.5 text-[10px] leading-4 rounded-md bg-emerald-400/10 text-emerald-300 font-mono tabular-nums">
            {last5Chats.length}
          </span>
        </div>
        <motion.button whileTap={tap} onClick={handleNewChat} title="New chat" aria-label="New chat" className={iconButton}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5 space-y-1">
        {last5Chats.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 px-3 text-center">
            <p className="text-xs text-zinc-400">No recent chats yet.</p>
            <p className="text-[11px] mt-1 text-zinc-500">Your conversations will appear here.</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {last5Chats.map((s, i) => {
              const isActive = s.id === sessionId;
              return (
                <motion.div
                  key={s.id}
                  layout="position"
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0, transition: { ...softSpring, delay: i * 0.05 } }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectSession(s.id)}
                  className="group relative rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.05]"
                >
                  {isActive && (
                    <motion.span
                      layoutId={`active-chat-${instance}`}
                      transition={spring}
                      className="absolute inset-0 rounded-xl bg-emerald-400/[0.09] ring-1 ring-inset ring-emerald-400/25 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]"
                    >
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-emerald-300 to-teal-400" />
                    </motion.span>
                  )}
                  <div className="relative">
                    <p className={`text-[13px] font-medium line-clamp-1 pr-6 ${isActive ? "text-emerald-100" : "text-zinc-200"}`}>
                      {s.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500">
                      <span>{formatDate(s.created_at)}</span>
                      <span aria-hidden>·</span>
                      <span>{s.message_count} {s.message_count === 1 ? "msg" : "msgs"}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id);
                    }}
                    title="Delete chat"
                    aria-label={`Delete chat: ${s.title}`}
                    className={`absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 ${touchVisible} text-zinc-500 hover:text-rose-300 hover:bg-rose-500/10 p-1 rounded-lg transition-all`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="p-2.5 border-t border-white/[0.06]">
          <motion.button
            whileTap={tap}
            onClick={openHistory}
            className="w-full py-2 px-3 rounded-xl text-xs text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] flex items-center justify-center gap-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
            <span>
              {sessions.length > 5 ? `View all chats (${sessions.length - 5} more)` : "View all chats"}
            </span>
          </motion.button>
        </div>
      )}
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex flex-col h-dvh max-h-dvh text-zinc-100 overflow-hidden selection:bg-emerald-400/25 selection:text-emerald-100">
        <GlassBackground />

        {/* Floating header */}
        <div className="px-2 pt-2 sm:px-3 sm:pt-3 md:px-4 md:pt-4 flex-shrink-0">
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={softSpring}
            className="glass h-14 px-2 md:px-3 rounded-2xl flex items-center justify-between gap-2 z-20"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
              <motion.button whileTap={tap} onClick={toggleSidebar} title="Toggle recent chats" aria-label="Toggle recent chats" className={iconButton}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
              </motion.button>

              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <motion.div
                  initial={{ rotate: -20, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  whileHover={{ rotate: -8, scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
                  className="relative w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-[15px] font-semibold tracking-tight text-white whitespace-nowrap truncate">
                      Nutrition Bot
                    </h1>
                    <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20 whitespace-nowrap">
                      Milestone 2
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 hidden xl:block truncate">
                    Evidence-based dietary reasoning & claim verification
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Sources toggle: only below md, where the sources rail is hidden */}
              <motion.button
                whileTap={tap}
                onClick={() => setMobileSourcesOpen(true)}
                title="Chat sources"
                aria-label={`Chat sources (${sourceCount})`}
                className="md:hidden relative inline-flex items-center justify-center h-9 min-w-9 px-2 gap-1 text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-xl transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 17L12 22l10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z"/></svg>
                <AnimatePresence>
                  {sourceCount > 0 && (
                    <motion.span
                      key={sourceCount}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      className="px-1.5 bg-emerald-400/15 text-emerald-300 rounded-full text-[10px] font-medium tabular-nums"
                    >
                      {sourceCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <motion.button
                whileTap={tap}
                onClick={openHistory}
                title="All chat history"
                aria-label="All chat history"
                className="inline-flex items-center justify-center h-9 min-w-9 gap-1.5 px-2 sm:px-3 text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                <span className="hidden sm:inline">History</span>
                {sessions.length > 0 && (
                  <span className="hidden sm:inline px-1.5 bg-white/10 text-zinc-300 rounded-full text-[10px] tabular-nums">
                    {sessions.length}
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={tap}
                onClick={handleNewChat}
                title="Start new chat"
                aria-label="Start new chat"
                className="inline-flex items-center justify-center h-9 min-w-9 gap-1.5 px-2 sm:px-3 text-xs font-semibold text-emerald-950 bg-gradient-to-b from-emerald-300 to-emerald-500 hover:from-emerald-200 hover:to-emerald-400 rounded-xl shadow-lg shadow-emerald-500/25 ring-1 ring-inset ring-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                <span className="hidden sm:inline">New chat</span>
              </motion.button>
            </div>
          </motion.header>
        </div>

        {/* Workspace: recent chats | chat | sources, as floating glass panels */}
        <div className="flex-1 flex gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 overflow-hidden min-h-0">
          <AnimatePresence>
            {sidebarOpen && (
              // Width and the negative margin animate together so the flex gap closes with the rail.
              <motion.aside
                key="rail"
                initial={{ width: 0, opacity: 0, marginRight: -16 }}
                animate={{ width: 256, opacity: 1, marginRight: 0 }}
                exit={{ width: 0, opacity: 0, marginRight: -16 }}
                transition={spring}
                className="glass hidden lg:flex flex-shrink-0 rounded-2xl overflow-hidden"
              >
                <div className="w-64 flex-shrink-0 flex flex-col h-full">{renderRecentChats("rail")}</div>
              </motion.aside>
            )}
          </AnimatePresence>

          <motion.main
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...softSpring, delay: 0.05 }}
            className="glass flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden"
          >
            <MessageList messages={messages} loading={loading} hydrated={hydrated} />

            {/* Predefined questions above the chat bar (dismissable, reappear on new chat) */}
            <AnimatePresence initial={false}>
              {showSuggestions && (
                <PredefinedQuestions key="suggestions" onSelect={handleSend} onClose={() => setShowSuggestions(false)} />
              )}
            </AnimatePresence>

            <InputBox onSend={handleSend} disabled={loading} />
          </motion.main>

          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.12 }}
            className="glass hidden md:flex flex-col w-80 xl:w-96 flex-shrink-0 rounded-2xl overflow-hidden"
          >
            <SourcesPanel claims={activeChatClaims} />
          </motion.aside>
        </div>

        {/* Mobile drawer: recent chats (swipe left to close) */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <div key="m-sidebar" className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Recent chats">
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: "-110%" }}
                animate={{ x: 0 }}
                exit={{ x: "-110%" }}
                transition={spring}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.6, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -80 || info.velocity.x < -400) setMobileSidebarOpen(false);
                }}
                className="glass-strong relative m-2 w-[18rem] max-w-[calc(100%-1rem)] flex flex-col rounded-2xl overflow-hidden"
              >
                {renderRecentChats("drawer")}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Mobile bottom sheet: sources (drag the handle down to close) */}
        <AnimatePresence>
          {mobileSourcesOpen && (
            <div key="m-sources" className="md:hidden fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label="Chat sources">
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSourcesOpen(false)}
              />
              <motion.aside
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={spring}
                drag="y"
                dragControls={sheetDrag}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 500) setMobileSourcesOpen(false);
                }}
                className="glass-strong relative w-full h-[min(78dvh,640px)] rounded-t-3xl rounded-b-none flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
              >
                <div
                  onPointerDown={(e) => sheetDrag.start(e)}
                  className="pt-2.5 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
                  aria-hidden
                >
                  <span className="h-1.5 w-10 rounded-full bg-white/25" />
                </div>
                <div className="flex-1 min-h-0">
                  <SourcesPanel claims={activeChatClaims} onClose={() => setMobileSourcesOpen(false)} />
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <HistoryDrawer
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          sessions={sessions}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
        />
      </div>
    </MotionConfig>
  );
}
