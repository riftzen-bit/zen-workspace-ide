// Centralized animation system — 5 easing curves + transition presets

export const ease = {
  panel: [0.16, 1, 0.3, 1] as const, // sidebar/chat open-close
  snappy: [0.32, 0.72, 0, 1] as const, // tooltips, small reveals
  gentle: [0.4, 0, 0.2, 1] as const, // overlays, page transitions
  bounce: [0.34, 1.56, 0.64, 1] as const, // playful controls (VibePlayer)
  linear: [0, 0, 1, 1] as const // progress bars
}

export const transition = {
  panel: { duration: 0.28, ease: ease.panel },
  tooltip: { duration: 0.14, ease: ease.snappy },
  fade: { duration: 0.2, ease: ease.gentle },
  overlay: { duration: 0.22, ease: ease.gentle },
  stagger: { staggerChildren: 0.06, delayChildren: 0.04 },
  bounce: { type: 'spring' as const, stiffness: 420, damping: 26 },
  micro: { duration: 0.11, ease: ease.snappy }
}

export const variants = {
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slideRight: { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 } },
  slideLeft: { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 } },
  slideUp: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } },
  scaleIn: { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 } }
}
