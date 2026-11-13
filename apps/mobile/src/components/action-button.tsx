import { useState } from 'react';
import { MotionPressable } from './motion-pressable';
import { Pressable, StyleSheet, Text } from 'react-native';
import { typography } from './typography';
import {
  buttonSurface,
  buttonLabel,
  type ButtonVariant,
} from '../theme/buttons';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  motionEnabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  motionEnabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const children = (
    <Text
      style={[
        typography.button,
        buttonLabel(variant, disabled),
        { textAlign: 'center' },
      ]}
    >
      {label}
    </Text>
  );
  const props = {
    accessibilityRole: 'button' as const,
    disabled,
    accessibilityState: { disabled },
    onPress,
  };
  return motionEnabled ? (
    <MotionPressable
      {...props}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, buttonSurface(variant, disabled, pressed)]}
    >
      {children}
    </MotionPressable>
  ) : (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.button,
        buttonSurface(variant, disabled, pressed),
      ]}
    >
      {children}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    // Keep the original content box and outer size when adding an outline.
    padding: spacing.md - 1,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
});
