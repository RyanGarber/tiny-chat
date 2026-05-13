import type { CSSProperties } from 'react';

/**
 * Unified "Liquid Glass" design tokens.
 *
 * Every translucent surface in the app should derive its look from these values
 * so a single edit here propagates everywhere.
 */

/* ── Core glass background ─────────────────────────────────────────────── */

/**
 * Glass background: body color mixed to ~85% opacity (15% transparent).
 */
export const GLASS_BG = 'color-mix(in srgb, var(--mantine-color-body), transparent 15%)';

/** Backdrop blur applied behind the glass surface. */
export const GLASS_BLUR = 'blur(10px)';

/** Subtle border that sits on top of the glass surface. */
export const GLASS_BORDER =
  '1px solid color-mix(in srgb, var(--mantine-color-default-border), transparent 33%)';

/* ── Hover tint ────────────────────────────────────────────────────────── */

/**
 * Hover tint colours.  Light mode gets a dark overlay, dark mode a light one.
 * These are expressed as CSS custom properties so they can be toggled by the
 * Mantine color-scheme data-attribute in a single stylesheet rule.
 */
export const HOVER_TINT_DARK = 'rgba(255, 255, 255, 0.1)';
export const HOVER_TINT_LIGHT = 'rgba(0, 0, 0, 0.1)';

/* ── Reusable style objects ────────────────────────────────────────────── */

/** Full glass CSSProperties — spread onto any `style` prop. */
export const glassStyle: CSSProperties = {
  backgroundColor: GLASS_BG,
  backdropFilter: GLASS_BLUR,
  border: GLASS_BORDER,
};
