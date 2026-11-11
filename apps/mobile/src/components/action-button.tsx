import { Pressable, StyleSheet, Text } from 'react-native';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.55 },
        pressed && !disabled && { opacity: 0.72 },
      ]}
    >
      <Text
        style={[
          typography.button,
          {
            color: secondary ? colors.onTint : colors.surface,
            textAlign: 'center',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    padding: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.tint,
  },
});
