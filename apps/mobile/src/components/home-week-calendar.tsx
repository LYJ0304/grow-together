import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { getWeek, shiftCalendarDate } from '../lib/calendar';
import { diaryDateKey, parseDiaryDate } from '../lib/diary-date';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MotionPressable } from './motion-pressable';

export const mondayWeekdays = ['월', '화', '수', '목', '금', '토', '일'];
export function HomeWeekCalendar({
  date,
  today,
  blocked,
  onChangeDate,
}: {
  date: string;
  today: string;
  blocked: boolean;
  onChangeDate(date: string): void;
}) {
  const selected = parseDiaryDate(date)!;
  const swipe = Gesture.Pan()
    .enabled(!blocked)
    .maxPointers(1)
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd(({ translationX }, success) => {
      if (success && !blocked && Math.abs(translationX) >= 40)
        onChangeDate(
          diaryDateKey(shiftCalendarDate(selected, translationX < 0 ? 7 : -7)),
        );
    });
  return (
    <GestureDetector gesture={swipe} touchAction="pan-y">
      <View
        testID="home-week-calendar"
        collapsable={false}
        role="group"
        accessibilityLabel="주간 날짜 선택"
        style={styles.week}
      >
        {getWeek(selected, 1).map((day, index) => (
          <HomeCalendarDay
            key={diaryDateKey(day)}
            day={day}
            date={date}
            today={today}
            blocked={blocked}
            weekday={mondayWeekdays[index]}
            onChangeDate={onChangeDate}
          />
        ))}
      </View>
    </GestureDetector>
  );
}
export function HomeCalendarDay({
  day,
  date,
  today,
  blocked,
  weekday,
  outsideMonth = false,
  onChangeDate,
}: {
  day: Date;
  date: string;
  today: string;
  blocked: boolean;
  weekday?: string;
  outsideMonth?: boolean;
  onChangeDate(date: string): void;
}) {
  const key = diaryDateKey(day);
  const selected = key === date;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일${key === today ? ', 오늘' : ''}`}
      accessibilityState={{ selected, disabled: blocked }}
      aria-pressed={selected}
      disabled={blocked}
      onPress={() => {
        if (!blocked) onChangeDate(key);
      }}
      style={styles.day}
    >
      {weekday ? <Text style={styles.weekday}>{weekday}</Text> : null}
      <View
        style={[
          styles.circle,
          selected && styles.selected,
          blocked && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.number,
            outsideMonth && styles.outside,
            selected && styles.selectedText,
            blocked && styles.disabledText,
          ]}
        >
          {day.getDate()}
        </Text>
      </View>
      <View
        accessible={false}
        style={[styles.dot, key === today && styles.today]}
      />
    </MotionPressable>
  );
}
export function CalendarArrow({
  direction,
  label,
  blocked,
  onPress,
}: {
  direction: 'previous' | 'next';
  label: string;
  blocked: boolean;
  onPress(): void;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={blocked}
      accessibilityState={{ disabled: blocked }}
      onPress={onPress}
      style={[styles.arrow, blocked && styles.disabled]}
    >
      <Image
        source={require('../../assets/images/main/chevron-left.svg')}
        tintColor={blocked ? colors.muted : colors.text}
        style={[styles.arrowIcon, direction === 'next' && styles.next]}
        accessible={false}
      />
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  week: { flexDirection: 'row', marginHorizontal: -14 },
  day: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  weekday: { ...typography.caption, color: colors.muted, fontSize: 12 },
  circle: {
    width: 36,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary },
  number: { ...typography.button, color: colors.text },
  selectedText: { color: colors.surface, fontWeight: '700' },
  outside: { color: colors.muted },
  dot: { width: 4, height: 4, borderRadius: 2 },
  today: { backgroundColor: colors.primary },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: colors.disabled },
  disabledText: { color: colors.muted },
  arrowIcon: { width: 20, height: 20 },
  next: { transform: [{ rotate: '180deg' }] },
});
