import { MotionPressable } from './motion-pressable';
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
  motionEnabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  motionEnabled?: boolean;
}) {
  return (
    <ButtonShell
      motionEnabled={motionEnabled}
      disabled={disabled}
      onPress={onPress}
      secondary={secondary}
    >
      <Text
        style={[
          typography.button,
          {
            color: secondary ? colors.onTint : colors.onBrand,
            textAlign: 'center',
          },
        ]}
      >
        {label}
      </Text>
    </ButtonShell>
  );
}
function ButtonShell({
  motionEnabled,
  disabled,
  secondary,
  onPress,
  children,
}: {
  motionEnabled: boolean;
  disabled: boolean;
  secondary: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const style = [
    styles.button,
    secondary && styles.secondary,
    disabled && { opacity: 0.55 },
  ];
  const props = {
    accessibilityRole: 'button' as const,
    disabled,
    accessibilityState: { disabled },
    onPress,
  };
  return motionEnabled ? (
    <MotionPressable {...props} style={style}>
      {children}
    </MotionPressable>
  ) : (
    <Pressable
      {...props}
      style={({ pressed }) => [
        style,
        pressed &&
          !disabled && {
            backgroundColor: secondary ? colors.surface : colors.tint,
          },
      ]}
    >
      {children}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    padding: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.tint,
  },
});
