import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useReduceMotion } from '../theme/motion';

export function ScheduleCheck({ completed }: { completed: boolean }) {
  const reduced = useReduceMotion();
  const value = useSharedValue(Number(completed));
  const scale = useSharedValue(1);
  const previous = useRef(completed);
  useEffect(() => {
    value.value = withTiming(Number(completed), {
      duration: reduced ? 0 : motion.state,
      reduceMotion: ReduceMotion.System,
    });
    if (reduced || !completed) scale.value = 1;
    else if (!previous.current)
      scale.value = withSequence(
        withTiming(1.08, {
          duration: 100,
          easing: motion.easeOut,
          reduceMotion: ReduceMotion.System,
        }),
        withSpring(1, motion.spring),
      );
    previous.current = completed;
  }, [completed, reduced, value, scale]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      value.value,
      [0, 1],
      [colors.background, colors.primary],
    ),
    transform: [{ scale: scale.value }],
  }));
  const mark = useAnimatedStyle(() => ({
    opacity: value.value,
    transform: [{ scale: reduced ? 1 : 0.8 + value.value * 0.2 }],
  }));
  return (
    <Animated.View accessible={false} style={[styles.check, style]}>
      <Animated.View style={mark}>
        <Text style={styles.mark}>✓</Text>
      </Animated.View>
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
