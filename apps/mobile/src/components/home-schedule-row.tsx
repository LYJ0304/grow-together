import { childReactionLabels } from './todo-reaction-modal';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { motion, useEntranceOnce, useReduceMotion } from '../theme/motion';
import { typography } from './typography';
import { MotionPressable } from './motion-pressable';
import { ScheduleCheck } from './schedule-check';
import type { TodoResponse } from '../lib/features/todo/types';

export function HomeScheduleRow({
  todo,
  now,
  pendingId,
  onToggle,
  onReaction,
  entrance,
  index,
}: {
  todo: TodoResponse;
  now: string;
  pendingId: number | null;
  onToggle: () => void;
  onReaction: () => void;
  entrance: boolean;
  index: number;
}) {
  const entry = useEntranceOnce(entrance, index * motion.stagger);
  const reduced = useReduceMotion();
  const completion = useSharedValue(Number(todo.completed));
  useEffect(() => {
    completion.value = withTiming(Number(todo.completed), {
      duration: reduced ? 0 : motion.state,
      reduceMotion: ReduceMotion.System,
    });
  }, [todo.completed, reduced, completion]);
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(
      completion.value,
      [0, 1],
      [colors.text, colors.muted],
    ),
  }));
  return (
    <Animated.View testID="home-schedule-row" style={[styles.row, entry]}>
      <MotionPressable
        accessibilityRole="checkbox"
        aria-checked={todo.completed}
        aria-busy={pendingId === todo.id}
        accessibilityLabel={`${todo.planName} 완료${todo.completed ? ' 취소' : ''}`}
        accessibilityState={{
          checked: todo.completed,
          disabled: pendingId !== null,
          busy: pendingId === todo.id,
        }}
        disabled={pendingId !== null}
        onPress={onToggle}
        style={styles.checkTarget}
      >
        <ScheduleCheck completed={todo.completed} />
      </MotionPressable>
      <View style={styles.copy}>
        <Animated.Text
          style={[styles.name, text, todo.completed && styles.completed]}
        >
          {todo.planName}
        </Animated.Text>
        <Text style={styles.meta}>
          {todo.scheduledTime.slice(0, 5)} ·{' '}
          {todo.completed
            ? '완료'
            : todo.scheduledTime < now
              ? '시간이 지난 미완료 일정'
              : '예정'}
        </Text>
        {todo.completed ? (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`${todo.planName} 반응 ${todo.childReaction ? '수정' : '기록'}`}
            disabled={pendingId !== null}
            accessibilityState={{ disabled: pendingId !== null }}
            onPress={onReaction}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.caption, { color: colors.onTint }]}>
              {todo.childReaction
                ? `${childReactionLabels[todo.childReaction]} · 수정`
                : '반응 남기기'}
            </Text>
          </MotionPressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { ...typography.body, fontWeight: '500', flexShrink: 1 },
  meta: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  checkTarget: {
    minWidth: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completed: { textDecorationLine: 'line-through' },
});
