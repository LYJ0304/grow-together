import { colors } from './colors';

// Action hierarchy, not a rotation of colors. Confirmation is the solid treatment
// of the same destructive role; ordinary delete entry points stay outlined.
export const buttonVariants = {
  primary: {
    background: colors.primary,
    foreground: colors.surface,
    pressed: colors.onTint,
    border: colors.primary,
  },
  secondary: {
    background: colors.tint,
    foreground: colors.onTint,
    pressed: colors.secondaryPressed,
    border: colors.tint,
  },
  tertiary: {
    background: colors.surface,
    foreground: colors.heading,
    pressed: colors.border,
    border: colors.controlBorder,
  },
  destructive: {
    background: colors.surface,
    foreground: colors.danger,
    pressed: colors.tint,
    border: colors.danger,
  },
  'destructive-confirm': {
    background: colors.danger,
    foreground: colors.surface,
    pressed: colors.onTint,
    border: colors.danger,
  },
} as const;
export type ButtonVariant = keyof typeof buttonVariants;

export function buttonSurface(
  variant: ButtonVariant,
  disabled = false,
  pressed = false,
) {
  const palette = buttonVariants[variant];
  return {
    backgroundColor: disabled
      ? colors.disabled
      : pressed
        ? palette.pressed
        : palette.background,
    borderColor: disabled ? colors.disabled : palette.border,
  };
}
export function buttonLabel(variant: ButtonVariant, disabled = false) {
  return {
    color: disabled ? colors.muted : buttonVariants[variant].foreground,
  };
}
