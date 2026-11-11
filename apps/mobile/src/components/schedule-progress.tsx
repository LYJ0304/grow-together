import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useReduceMotion } from '../theme/motion';

export function ScheduleProgress({ progress }: { progress: number }) {
  const reduced = useReduceMotion();
  const value = useSharedValue(progress);
  useEffect(() => {
    value.value = withTiming(progress, {
      duration: reduced ? 0 : motion.progress,
      easing: motion.easeOut,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress, reduced, value]);
  const fill = useAnimatedStyle(() => ({ width: `${value.value}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="오늘 일정 완료율"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-valuetext={`${progress}퍼센트`}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: progress,
        text: `${progress}퍼센트`,
      }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}
const styles = StyleSheet.create({
  track: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
});
