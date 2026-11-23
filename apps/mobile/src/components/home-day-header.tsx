import { type ComponentRef, useRef, useState } from 'react';
import { AppHeader } from './app-header';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useEntranceOnce } from '../theme/motion';
import { typography } from '../theme/typography';
import { MotionPressable } from './motion-pressable';
import { diaryDateKey, parseDiaryDate } from '../lib/diary-storage';
import { shiftCalendarDate } from '../lib/calendar';
import { CalendarArrow, HomeWeekCalendar } from './home-week-calendar';
import { HomeDatePickerModal } from './home-date-picker-modal';
export function HomeDayHeader({
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
  const heading = useEntranceOnce();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerButton = useRef<ComponentRef<typeof View>>(null);
  const day = parseDiaryDate(date)!;
  const change = (offset: number) => {
    if (!blocked) onChangeDate(diaryDateKey(shiftCalendarDate(day, offset)));
  };
  const close = () => {
    setPickerOpen(false);
    requestAnimationFrame(() => pickerButton.current?.focus());
  };
  return (
    <View style={styles.header}>
      <AppHeader disabled={blocked} style={styles.navigation} />
      <View style={styles.monthRow}>
        <CalendarArrow
          direction="previous"
          label="이전 주"
          blocked={blocked}
          onPress={() => change(-7)}
        />
        <Animated.View testID="home-day-heading" style={[styles.copy, heading]}>
          <Text accessibilityRole="header" style={styles.title}>
            {day.getFullYear()}년 {day.getMonth() + 1}월
          </Text>
        </Animated.View>
        <CalendarArrow
          direction="next"
          label="다음 주"
          blocked={blocked}
          onPress={() => change(7)}
        />
        <MotionPressable
          ref={pickerButton}
          accessibilityRole="button"
          accessibilityLabel="날짜 선택"
          disabled={blocked}
          accessibilityState={{ disabled: blocked }}
          onPress={() => setPickerOpen(true)}
          style={[
            styles.iconButton,
            blocked && { backgroundColor: colors.disabled },
          ]}
        >
          <Image
            source={require('../../assets/images/main/calendar.svg')}
            style={styles.icon}
            accessible={false}
          />
        </MotionPressable>
      </View>
      <HomeWeekCalendar
        date={date}
        today={today}
        blocked={blocked}
        onChangeDate={onChangeDate}
      />
      <View style={styles.selectedRow}>
        <Text style={styles.date}>
          {day.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </Text>
        {date !== today ? (
          <MotionPressable
            accessibilityRole="button"
            disabled={blocked}
            accessibilityState={{ disabled: blocked }}
            onPress={() => {
              if (!blocked) onChangeDate(today);
            }}
            style={styles.today}
          >
            <Text style={styles.todayText}>오늘로 돌아가기</Text>
          </MotionPressable>
        ) : null}
      </View>
      {pickerOpen ? (
        <HomeDatePickerModal
          date={date}
          today={today}
          blocked={blocked}
          onClose={close}
          onChangeDate={onChangeDate}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: 8 },
  navigation: { paddingHorizontal: 0 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    ...typography.section,
    fontSize: 22,
    lineHeight: 30,
    color: colors.heading,
  },
  iconButton: {
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 22, height: 22 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 24,
  },
  date: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  today: { minHeight: 44, justifyContent: 'center' },
  todayText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
