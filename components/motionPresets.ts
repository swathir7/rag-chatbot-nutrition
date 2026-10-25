import type { Transition, Variants } from "motion/react";

// Snappy spring for panels, drawers and shared-layout moves.
export const spring: Transition = { type: "spring", stiffness: 380, damping: 34, mass: 0.8 };

// Softer spring for content entering (messages, cards).
export const softSpring: Transition = { type: "spring", stiffness: 240, damping: 26 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: softSpring },
};

export const blurUp: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export const staggerChildren = (stagger = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const tap = { scale: 0.94 };
export const hoverLift = { y: -2 };
