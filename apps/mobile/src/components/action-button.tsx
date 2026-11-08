import { Pressable, StyleSheet, Text } from 'react-native';
import { typography } from './typography';

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
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.55 },
      ]}
    >
      <Text
        style={[
          typography.button,
          { color: secondary ? '#A84D40' : '#FFFFFF', textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: '#B25447',
  },
  secondary: {
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#E9D2C8',
  },
});
