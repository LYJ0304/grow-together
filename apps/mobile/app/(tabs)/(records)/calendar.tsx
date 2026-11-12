import { buttonForeground, buttonTones } from '../../../src/theme/buttons';
import { colors } from '../../../src/theme/colors';
import { useTabScrollToTop } from '../../../src/lib/use-tab-scroll-to-top';
import { useAuth } from '../../../src/components/auth-provider';
import {
  useSessionStore,
  useSessionValue,
} from '../../../src/lib/session-state';
import { typography } from '../../../src/components/typography';
import { createDiaryApi } from '../../../src/lib/features/diary/diaryApi';
import { AppHeader } from '../../../src/components/app-header';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calendarDays } from '../../../src/lib/calendar';
import {
  diaryDateKey,
  parseDiaryDate,
  savedDiaryDates,
  readDiary,
} from '../../../src/lib/diary-storage';

export default function CalendarScreen() {
  const { status, client, epoch } = useAuth();
  const preview = status === 'preview';
  const values = useSessionStore((state) => state.values);
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const {
    date: dateParam,
    saved,
    deleted,
  } = useLocalSearchParams<{
    date?: string;
    saved?: string;
    deleted?: string;
  }>();
  const scroll = useRef<ScrollView>(null);
  useTabScrollToTop(scroll);
  const [initialDate] = useState(() => {
    const fromRoute = parseDiaryDate(dateParam);
    if (fromRoute) return fromRoute;
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [month, setMonth] = useSessionValue(
    'calendarMonth',
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [selected, setSelected] = useSessionValue('calendarDate', initialDate);
  const [notice, setNotice] = useState('');
  const monthKey = diaryDateKey(month).slice(0, 7);
  const {
    data: dates,
    isFetching: loadingDiaries,
    error: diaryError,
    refetch,
  } = useQuery({
    queryKey: ['savedDiaryDates', preview ? 'preview' : epoch, monthKey],
    enabled: preview || status === 'authenticated',
    queryFn: async () =>
      preview
        ? savedDiaryDates()
        : (await createDiaryApi(client).getMonth(monthKey)).map(
            (entry) => entry.diaryDate,
          ),
    retry: false,
  });
  const savedDates = new Set(dates ?? []);
  const summary = useQuery({
    queryKey: [
      'diarySummary',
      preview ? 'preview' : epoch,
      diaryDateKey(selected),
    ],
    enabled: savedDates.has(diaryDateKey(selected)),
    retry: false,
    queryFn: async () =>
      preview
        ? ((await readDiary(diaryDateKey(selected)))?.content ?? '')
        : ((await createDiaryApi(client).getByDate(diaryDateKey(selected)))
            .content ?? ''),
  });
  const diaryNotice =
    diaryError instanceof Error
      ? diaryError.message
      : savedDates.has(diaryDateKey(selected)) && summary.isError
        ? '일기 요약을 불러오지 못했어요.'
        : '';
  const hasDraft = Object.entries(values).some(
    ([key, value]) =>
      key.startsWith(`diary:${diaryDateKey(selected)}:`) &&
      key.endsWith(':dirty') &&
      value === true,
  );
  const selectedHasDiary = savedDates.has(diaryDateKey(selected));

  useEffect(() => {
    const fromRoute = parseDiaryDate(dateParam);
    if (!fromRoute) return;
    setSelected(fromRoute);
    setMonth(new Date(fromRoute.getFullYear(), fromRoute.getMonth(), 1));
    router.setParams({ date: '', saved: '', deleted: '' });
    setNotice(
      deleted === 'true'
        ? '일기를 삭제했어요.'
        : saved === 'true'
          ? '일기를 저장했어요.'
          : '',
    );
  }, [dateParam, saved, deleted, setMonth, setSelected]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const days = calendarDays(month);
  const today = new Date();
  const todayKey = diaryDateKey(today);
  const selectedDateLabel = `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][selected.getDay()]}요일`;
  const selectionHint = diaryNotice
    ? '일기 목록을 다시 불러온 뒤 확인해주세요.'
    : loadingDiaries
      ? '저장된 일기를 확인하고 있어요.'
      : hasDraft
        ? '이 세션에서 작성하던 내용이 있어요.'
        : selectedHasDiary
          ? preview
            ? '이 기기에 저장된 미리보기 일기예요.'
            : '서버에 저장된 일기예요.'
          : preview
            ? '저장된 미리보기 기록이 없어요. 오늘의 순간을 남겨보세요.'
            : '저장된 일기가 없어요. 오늘의 순간을 남겨보세요.';

  const changeMonth = (offset: number) => {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
    setNotice('');
  };

  if (!hydrated)
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <StatusBar style="dark" />
        <View style={[styles.content, { flex: 1 }]}>
          <Text style={styles.notice}>캘린더를 불러오는 중이에요.</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader />
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            onPress={() => changeMonth(-1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../../../assets/images/calendar/previous.svg')}
              style={styles.arrow}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
          <View style={styles.monthTitle}>
            <Text accessibilityRole="header" style={styles.month}>
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            onPress={() => changeMonth(1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../../../assets/images/calendar/next.svg')}
              style={[styles.arrow, styles.nextArrow]}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
        </View>

        <View style={styles.calendarToolbar}>
          <Text style={styles.calendarCaption}>우리의 기록</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="오늘로 이동"
            onPress={() => {
              const current = new Date();
              setSelected(
                new Date(
                  current.getFullYear(),
                  current.getMonth(),
                  current.getDate(),
                ),
              );
              setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
              setNotice('');
            }}
            style={({ pressed }) => [
              styles.todayButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.todayLabel}>오늘</Text>
          </Pressable>
        </View>
        <View style={styles.calendar}>
          <View style={styles.weekdays}>
            {['일', '월', '화', '수', '목', '금', '토'].map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.weekday,
                  (index === 0 || index === 6) && styles.weekend,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          <View testID="calendar-grid" style={styles.weeks}>
            {Array.from({ length: days.length / 7 }, (_, week) => (
              <View testID="calendar-week" key={week} style={styles.week}>
                {days.slice(week * 7, week * 7 + 7).map((date) => {
                  const isSelected = date.getTime() === selected.getTime();
                  const outsideMonth = date.getMonth() !== month.getMonth();
                  const isToday = diaryDateKey(date) === todayKey;
                  const hasDiary = savedDates.has(diaryDateKey(date));
                  return (
                    <Pressable
                      key={date.getTime()}
                      accessibilityRole="button"
                      accessibilityLabel={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일${isToday ? ', 오늘' : ''}${hasDiary ? ', 일기 있음' : ''}`}
                      accessibilityState={{ selected: isSelected }}
                      aria-pressed={isSelected}
                      onPress={() => {
                        setSelected(date);
                        if (outsideMonth)
                          setMonth(
                            new Date(date.getFullYear(), date.getMonth(), 1),
                          );
                        setNotice('');
                      }}
                      style={({ pressed }) => [
                        styles.day,
                        isToday && styles.todayDay,
                        isSelected && styles.selectedDay,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          (date.getDay() === 0 || date.getDay() === 6) &&
                            styles.weekend,
                          outsideMonth && styles.outsideDay,
                          isSelected && styles.selectedDayText,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                      {hasDiary ? (
                        <View
                          accessible={false}
                          style={[
                            styles.diaryDot,
                            isSelected && styles.selectedDiaryDot,
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
        {savedDates.size > 0 ? (
          <Text style={styles.diaryLegend}>
            <Text style={styles.legendDot}>●</Text> 일기가 저장된 날
          </Text>
        ) : null}
        <View testID="calendar-selection" style={styles.actions}>
          <Text style={styles.selectionEyebrow}>선택한 날의 기록</Text>
          <Text style={styles.selectionDate}>{selectedDateLabel}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.selectionHint}>
            {selectionHint}
          </Text>
          {!preview ? (
            <Text style={styles.selectionHint}>
              로그인한 계정의 서버 일기를 표시해요. 날짜가 없는 과거 기록은
              표시되지 않아요.
            </Text>
          ) : null}
          {summary.data ? (
            <Text
              numberOfLines={4}
              style={[
                typography.body,
                { color: colors.text, alignSelf: 'stretch', marginBottom: 12 },
              ]}
            >
              {summary.data}
            </Text>
          ) : null}
          {diaryNotice || notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {diaryNotice || notice}
            </Text>
          ) : null}
          {diaryNotice ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void refetch();
                if (selectedHasDiary) void summary.refetch();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryLabel}>일기 목록 다시 불러오기</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedHasDiary
                ? '선택한 날짜의 일기 보기'
                : hasDraft
                  ? '작성하던 일기 이어 쓰기'
                  : '선택한 날짜의 일기 작성하기'
            }
            disabled={loadingDiaries || !!diaryNotice}
            onPress={() =>
              router.push({
                pathname: '/diary',
                params: {
                  date: diaryDateKey(selected),
                  mode: selectedHasDiary ? 'view' : 'create',
                },
              })
            }
            style={({ pressed }) => [
              styles.generateButton,
              (loadingDiaries || !!diaryNotice) && styles.pressed,
              pressed && styles.generatePressed,
            ]}
          >
            <Text style={styles.generateLabel}>
              {loadingDiaries
                ? '불러오는 중...'
                : selectedHasDiary
                  ? '일기 보기'
                  : hasDraft
                    ? '작성하던 일기 이어 쓰기'
                    : '일기 작성하기'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingTop: 12,
    // Seven 44px touch targets still fit a 320px viewport.
    paddingHorizontal: 6,
    paddingBottom: 24,
    alignItems: 'center',
  },
  monthHeader: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { width: 7, height: 14 },
  nextArrow: { transform: [{ scaleX: -1 }] },
  monthTitle: { flex: 1, alignItems: 'center' },
  month: {
    ...typography.section,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  calendarToolbar: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  calendarCaption: { ...typography.caption, fontSize: 13, color: colors.muted },
  todayButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLabel: { ...typography.label, fontSize: 14, color: colors.primary },
  calendar: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 16,
  },
  weekdays: { flexDirection: 'row', marginTop: 2, marginBottom: 4 },
  weekday: {
    flex: 1,
    ...typography.caption,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.muted,
  },
  weekend: { color: colors.primary },
  weeks: { marginTop: 8, gap: 2 },
  week: { flexDirection: 'row' },
  day: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    ...typography.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  outsideDay: { color: colors.muted },
  todayDay: { borderColor: colors.primary },
  selectedDay: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedDayText: { color: colors.surface },
  diaryDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  selectedDiaryDot: { backgroundColor: colors.surface },
  legendDot: { color: colors.primary },
  diaryLegend: {
    marginTop: 10,
    ...typography.caption,
    lineHeight: 16,
    color: colors.muted,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  retryLabel: { ...typography.label, fontSize: 14, color: colors.primary },
  actions: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 14,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  selectionEyebrow: {
    ...typography.caption,
    lineHeight: 16,
    color: colors.primary,
  },
  selectionDate: {
    ...typography.section,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  selectionHint: {
    ...typography.caption,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 14,
    textAlign: 'center',
  },
  generateButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: buttonTones.default.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  generatePressed: { backgroundColor: buttonTones.default.pressed },
  generateLabel: {
    ...typography.button,
    fontSize: 16,
    lineHeight: 22,
    color: buttonForeground,
    textAlign: 'center',
  },
  notice: {
    marginBottom: 12,
    ...typography.label,
    lineHeight: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
});
