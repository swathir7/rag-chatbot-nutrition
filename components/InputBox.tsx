import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function InputBox({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to ~6 lines, then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Return focus to the box once an answer arrives (desktop only: on phones it
  // would pop the keyboard back over the answer the user is about to read)
  useEffect(() => {
    if (!disabled && window.matchMedia("(hover: hover)").matches) textareaRef.current?.focus();
  }, [disabled]);

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="px-2.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-3 sm:pb-3 md:px-6 md:pb-5 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Soft gradient glow while focused */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[1.35rem] bg-gradient-to-r from-emerald-400/35 via-teal-300/25 to-indigo-400/30 blur-lg"
            initial={false}
            animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.98 }}
            transition={{ duration: 0.3 }}
          />
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 rounded-2xl bg-[#0b0e13]/70 p-1.5 sm:p-2 pl-3.5 sm:pl-4 ring-1 ring-inset ring-white/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)] focus-within:ring-emerald-300/40 transition-[box-shadow,background-color]"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              // 16px on phones stops iOS Safari zooming the page on focus
              className="flex-1 min-w-0 resize-none bg-transparent py-2 text-base sm:text-sm leading-6 text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed max-h-40"
              placeholder="Ask a nutrition question…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={disabled}
              enterKeyHint="send"
              aria-label="Nutrition question input"
            />
            <motion.button
              type="submit"
              disabled={!canSend}
              aria-label="Send question"
              whileHover={canSend ? { scale: 1.06 } : undefined}
              whileTap={canSend ? { scale: 0.9 } : undefined}
              animate={{ scale: canSend ? 1 : 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="h-10 w-10 sm:h-9 sm:w-9 flex-shrink-0 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30 ring-1 ring-inset ring-white/30 hover:from-emerald-200 hover:to-emerald-400 disabled:from-white/10 disabled:to-white/5 disabled:text-zinc-500 disabled:shadow-none disabled:ring-white/10 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <AnimatePresence mode="wait" initial={false}>
                {disabled ? (
                  <motion.span
                    key="spin"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"
                  />
                ) : (
                  <motion.svg
                    key="arrow"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="m5 12 7-7 7 7"/>
                    <path d="M12 19V5"/>
                  </motion.svg>
                )}
              </AnimatePresence>
            </motion.button>
          </form>
        </div>
        <p className="hidden sm:block text-[11px] text-zinc-500 mt-2 text-center">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white/[0.06] rounded-md ring-1 ring-inset ring-white/10 font-mono text-zinc-300">Enter</kbd> to send
          <span className="mx-1.5 text-zinc-600">·</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white/[0.06] rounded-md ring-1 ring-inset ring-white/10 font-mono text-zinc-300">Shift + Enter</kbd> for a new line
        </p>
      </div>
    </div>
  );
}
