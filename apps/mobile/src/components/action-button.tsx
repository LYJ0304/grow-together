import { MotionPressable } from './motion-pressable';
import { Pressable, StyleSheet, Text } from 'react-native';
import { typography } from './typography';
import {
  buttonForeground,
  buttonTones,
  type ButtonTone,
} from '../theme/buttons';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export function ActionButton({
  label,
  onPress,
  tone = 'default',
  disabled = false,
  motionEnabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  motionEnabled?: boolean;
}) {
  return (
    <ButtonShell
      motionEnabled={motionEnabled}
      disabled={disabled}
      onPress={onPress}
      tone={tone}
    >
      <Text
        style={[
          typography.button,
          {
            color: buttonForeground,
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
  tone,
  onPress,
  children,
}: {
  motionEnabled: boolean;
  disabled: boolean;
  tone: ButtonTone;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const style = [
    styles.button,
    { backgroundColor: buttonTones[tone].background },
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
            backgroundColor: buttonTones[tone].pressed,
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
  },
});
