import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { calendarDays, getWeek } from '../../lib/calendar';
import { diaryDateKey, parseDiaryDate } from '../../lib/diary-storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { CalendarArrow, mondayWeekdays } from '../home-week-calendar';
import { DateSelection } from '../onboarding/date-field';

export function RecordCalendar({
  month,
  selected,
  today,
  expanded,
  list,
  dates,
  statusForDate,
  onExpanded,
  onDate,
  onToday,
  onStep,
}: {
  month: Date;
  selected: Date;
  today: string;
  expanded: boolean;
  list: boolean;
  dates: Set<string>;
  statusForDate(date: string): 'loading' | 'error' | 'ready';
  onExpanded(value: boolean): void;
  onDate(date: Date): void;
  onToday(): void;
  onStep(offset: number): void;
}) {
  const [jump, setJump] = useState(false);
  const jumpButton = useRef<ComponentRef<typeof View>>(null);
  const days = expanded ? calendarDays(month, 1) : getWeek(selected, 1);
  const key = diaryDateKey(selected);
  const close = () => {
    setJump(false);
    requestAnimationFrame(() => jumpButton.current?.focus());
  };
  return (
    <View>
      <View style={styles.header}>
        <Pressable
          ref={jumpButton}
          accessibilityRole="button"
          accessibilityLabel={
            list
              ? '연월 바로 이동'
              : expanded
                ? '월간 캘린더 접기'
                : '월간 캘린더 펼치기'
          }
          aria-expanded={!list && expanded}
          onPress={() => (list ? setJump(true) : onExpanded(!expanded))}
          style={styles.monthButton}
        >
          <Text accessibilityRole="header" style={styles.month}>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </Text>
          <Image
            source={require('../../../assets/images/main/chevron-left.svg')}
            style={[
              styles.icon,
              {
                transform: [{ rotate: expanded && !list ? '90deg' : '-90deg' }],
              },
            ]}
            accessible={false}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="오늘로 이동"
          onPress={onToday}
          style={styles.today}
        >
          <Text style={styles.todayText}>오늘</Text>
        </Pressable>
        <CalendarArrow
          direction="previous"
          label={list || expanded ? '이전 달' : '이전 주'}
          blocked={false}
          onPress={() => onStep(-1)}
        />
        <CalendarArrow
          direction="next"
          label={list || expanded ? '다음 달' : '다음 주'}
          blocked={false}
          onPress={() => onStep(1)}
        />
      </View>
      {!list ? (
        <>
          {expanded ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="날짜 바로 이동"
              onPress={() => setJump(true)}
              style={styles.jump}
            >
              <Text style={styles.todayText}>연도·월 바로 선택</Text>
            </Pressable>
          ) : null}
          <View style={styles.week}>
            {mondayWeekdays.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>
          <View testID={expanded ? 'calendar-grid' : 'records-week-calendar'}>
            {Array.from({ length: days.length / 7 }, (_, week) => (
              <View key={week} style={styles.week}>
                {days.slice(week * 7, week * 7 + 7).map((day) => {
                  const date = diaryDateKey(day),
                    chosen = date === key,
                    hasDiary = dates.has(date),
                    isToday = date === today,
                    state = statusForDate(date);
                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={`${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일${isToday ? ', 오늘' : ''}${hasDiary ? ', 일기 있음' : ''}`}
                      accessibilityHint={
                        state === 'error'
                          ? '이 날짜의 기록 조회에 실패했어요.'
                          : state === 'loading'
                            ? '기록이 있는지 확인 중이에요.'
                            : undefined
                      }
                      aria-pressed={chosen}
                      disabled={!parseDiaryDate(date)}
                      accessibilityState={{
                        selected: chosen,
                        disabled: !parseDiaryDate(date),
                      }}
                      onPress={() => onDate(day)}
                      style={styles.day}
                    >
                      <View
                        style={[
                          styles.circle,
                          isToday && styles.todayCircle,
                          chosen && styles.selected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.number,
                            expanded &&
                              day.getMonth() !== month.getMonth() &&
                              styles.outside,
                            chosen && styles.selectedText,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                      <View
                        accessible={false}
                        style={[styles.dot, hasDiary && styles.recorded]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : null}
      {jump ? (
        <DateSelection
          label="날짜 바로 이동"
          minimumYear={1000}
          value={key}
          onCancel={close}
          onDismiss={() => jumpButton.current?.focus()}
          onConfirm={(value) => {
            const next = parseDiaryDate(value);
            if (next) {
              onDate(next);
              close();
            }
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  monthButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 10,
  },
  month: {
    ...typography.section,
    fontSize: 18,
    lineHeight: 26,
    color: colors.heading,
  },
  icon: { width: 16, height: 16 },
  today: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  jump: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  week: { flexDirection: 'row' },
  weekday: {
    ...typography.caption,
    color: colors.muted,
    flex: 1,
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  day: {
    flex: 1,
    minWidth: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  circle: {
    minHeight: 36,
    width: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { borderColor: colors.primary },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  number: { ...typography.button, color: colors.text },
  selectedText: { color: colors.surface, fontWeight: '700' },
  outside: { color: colors.muted },
  dot: { height: 4, width: 4, borderRadius: 2 },
  recorded: { backgroundColor: colors.primary },
});
