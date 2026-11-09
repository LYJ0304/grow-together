import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useReduceMotion } from '../theme/motion';

export function ScheduleCheck({ completed }: { completed: boolean }) {
  const reduced = useReduceMotion();
  const value = useSharedValue(Number(completed));
  useEffect(() => {
    value.value = withTiming(Number(completed), {
      duration: reduced ? 0 : motion.quick,
      reduceMotion: ReduceMotion.System,
    });
  }, [completed, reduced, value]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      value.value,
      [0, 1],
      [colors.background, colors.primary],
    ),
  }));
  return (
    <Animated.View style={[styles.check, style]}>
      <Text style={styles.mark}>{completed ? '✓' : ''}</Text>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontSize: 16, color: colors.surface },
});
