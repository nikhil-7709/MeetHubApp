export const palette = {
  primary: '#4F46E5',    // Indigo 600
  primaryDark: '#3730A3',
  accent: '#818CF8',     // Indigo 400
  ink: '#0F172A',        // Slate 900
  muted: '#64748B',      // Slate 500
  canvas: '#F8FAFC',     // Slate 50
  card: '#FFFFFF',
  border: '#E2E8F0',     // Slate 200
  green: '#10B981',      // Emerald 500
  red: '#EF4444',        // Red 500
  darkCanvas: '#020617', // Slate 950
  darkCard: '#0F172A',   // Slate 900
  darkBorder: '#1E293B', // Slate 800
  white: '#FFFFFF',
};

const lightColors = {
  background: palette.canvas,
  surface: palette.card,
  text: palette.ink,
  muted: palette.muted,
  border: palette.border,
  primary: palette.primary,
  danger: palette.red,
  success: palette.green,
};

export type AppPalette = typeof lightColors;
export const lightPalette = lightColors;
export const darkPalette: AppPalette = {
  ...lightColors,
  background: palette.darkCanvas,
  surface: palette.darkCard,
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: palette.darkBorder,
};
