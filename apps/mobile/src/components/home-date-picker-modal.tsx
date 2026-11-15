import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calendarDays } from '../lib/calendar';
import { diaryDateKey, parseDiaryDate } from '../lib/diary-storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ActionButton } from './action-button';
import {
  CalendarArrow,
  HomeCalendarDay,
  mondayWeekdays,
} from './home-week-calendar';
export function HomeDatePickerModal({
  date,
  today,
  blocked,
  onChangeDate,
  onClose,
}: {
  date: string;
  today: string;
  blocked: boolean;
  onChangeDate(date: string): void;
  onClose(): void;
}) {
  const [month, setMonth] = useState(() => {
    const day = parseDiaryDate(date)!;
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });
  const days = calendarDays(month, 1);
  const changeMonth = (offset: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
          <View
            role="dialog"
            accessibilityLabel="날짜 선택"
            accessibilityViewIsModal
            aria-modal
          >
            <View style={styles.header}>
              <CalendarArrow
                direction="previous"
                label="이전 달"
                blocked={blocked}
                onPress={() => changeMonth(-1)}
              />
              <Text accessibilityRole="header" style={styles.title}>
                {month.getFullYear()}년 {month.getMonth() + 1}월
              </Text>
              <CalendarArrow
                direction="next"
                label="다음 달"
                blocked={blocked}
                onPress={() => changeMonth(1)}
              />
            </View>
            <View style={styles.week}>
              {mondayWeekdays.map((label) => (
                <Text key={label} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>
            {Array.from({ length: days.length / 7 }, (_, index) => (
              <View key={index} style={styles.week}>
                {days.slice(index * 7, index * 7 + 7).map((day) => (
                  <HomeCalendarDay
                    key={diaryDateKey(day)}
                    day={day}
                    date={date}
                    today={today}
                    outsideMonth={day.getMonth() !== month.getMonth()}
                    blocked={blocked}
                    onChangeDate={(next) => {
                      if (!blocked) {
                        onChangeDate(next);
                        onClose();
                      }
                    }}
                  />
                ))}
              </View>
            ))}
            <View style={styles.actions}>
              <ActionButton label="취소" variant="tertiary" onPress={onClose} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 16,
    backgroundColor: colors.overlay,
  },
  panel: {
    flexGrow: 0,
    maxHeight: '100%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  content: { paddingVertical: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  title: { ...typography.section, color: colors.heading },
  week: { flexDirection: 'row' },
  weekday: {
    ...typography.caption,
    color: colors.muted,
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
  },
  actions: { padding: 16 },
});
