export const palette = {
  primary: '#5746E8',
  primaryDark: '#4132C3',
  accent: '#8274FF',
  ink: '#172033',
  muted: '#7B8498',
  canvas: '#F5F6FB',
  card: '#FFFFFF',
  border: '#E7E9F1',
  green: '#1C9A72',
  red: '#E45464',
  darkCanvas: '#111521',
  darkCard: '#1B2130',
  darkBorder: '#2B3345',
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
  text: '#F4F6FC',
  muted: '#A6AEC0',
  border: palette.darkBorder,
};
