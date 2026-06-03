import type { CSSProperties } from 'react';

export const GLASS_BG = 'color-mix(in srgb, var(--tc-surface), transparent 15%)';
export const GLASS_BLUR = 'blur(10px)';
export const GLASS_BORDER = '1px solid color-mix(in srgb, var(--tc-surface), #ffffff 15%)';
export const glassStyle: CSSProperties = {
  backgroundColor: GLASS_BG,
  backdropFilter: GLASS_BLUR,
  border: GLASS_BORDER,
};
