import { colors } from './colors';

// Fixed roles for distinct actions in one view; never assign tones by list index.
export const buttonTones = {
  default: { background: colors.tint, pressed: colors.buttonRose },
  rose: { background: colors.buttonRose, pressed: colors.buttonPetal },
  blush: { background: colors.buttonBlush, pressed: colors.buttonRose },
  petal: { background: colors.buttonPetal, pressed: colors.buttonRose },
  mist: { background: colors.buttonMist, pressed: colors.buttonBlush },
} as const;
export type ButtonTone = keyof typeof buttonTones;
export const buttonForeground = colors.onTint;
