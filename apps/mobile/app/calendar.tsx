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
import { BottomNavigation } from '../src/components/bottom-navigation';
import { calendarDays } from '../src/lib/calendar';
import {
  diaryDateKey,
  parseDiaryDate,
  savedDiaryDates,
} from '../src/lib/diary-storage';

export default function CalendarScreen() {
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
  const [initialDate] = useState(() => {
    const fromRoute = parseDiaryDate(dateParam);
    if (fromRoute) return fromRoute;
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [month, setMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [selected, setSelected] = useState(initialDate);
  const [notice, setNotice] = useState('');
  const {
    data: dates,
    isFetching: loadingDiaries,
    error: diaryError,
    refetch,
  } = useQuery({
    queryKey: ['savedDiaryDates'],
    queryFn: savedDiaryDates,
    retry: false,
  });
  const savedDates = new Set(dates ?? []);
  const diaryNotice = diaryError instanceof Error ? diaryError.message : '';
  const selectedHasDiary = savedDates.has(diaryDateKey(selected));

  useEffect(() => {
    const fromRoute = parseDiaryDate(dateParam);
    if (!fromRoute) return;
    setSelected(fromRoute);
    setMonth(new Date(fromRoute.getFullYear(), fromRoute.getMonth(), 1));
    setNotice(
      deleted === 'true'
        ? '일기를 삭제했어요.'
        : saved === 'true'
          ? '일기를 저장했어요.'
          : '',
    );
  }, [dateParam, saved, deleted]);

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
      : selectedHasDiary
        ? '이날의 성장 이야기가 저장되어 있어요.'
        : '하루의 작은 성장을 일기로 남겨보세요.';

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
              source={require('../assets/images/calendar/previous.svg')}
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
              source={require('../assets/images/calendar/next.svg')}
              style={[styles.arrow, styles.nextArrow]}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
        </View>

        <View style={styles.calendarToolbar}>
          <Text style={styles.calendarCaption}>우리의 성장 기록</Text>
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
          <Text style={styles.selectionEyebrow}>선택한 날의 일기</Text>
          <Text style={styles.selectionDate}>{selectedDateLabel}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.selectionHint}>
            {selectionHint}
          </Text>
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
              onPress={() => refetch()}
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
                : '선택한 날짜의 일기 생성하기'
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
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.generateLabel}>
              {loadingDiaries
                ? '불러오는 중...'
                : selectedHasDiary
                  ? '일기 보기'
                  : '일기 생성하기'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomNavigation
        active="캘린더"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onUnavailable={(label) => setNotice(`${label} 화면은 준비 중입니다.`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE1DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { width: 7, height: 14 },
  nextArrow: { transform: [{ scaleX: -1 }] },
  monthTitle: { flex: 1, alignItems: 'center' },
  month: {
    fontFamily: 'Jua',
    fontSize: 22,
    lineHeight: 28,
    color: '#433C39',
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
  calendarCaption: { fontFamily: 'Jua', fontSize: 13, color: '#756A65' },
  todayButton: {
    minWidth: 52,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLabel: { fontFamily: 'Jua', fontSize: 14, color: '#A84D40' },
  calendar: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 10,
  },
  weekdays: { flexDirection: 'row', marginTop: 2, marginBottom: 4 },
  weekday: {
    flex: 1,
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    color: '#73737D',
  },
  weekend: { color: '#D26A5C' },
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
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  outsideDay: { color: '#B8B8C1' },
  todayDay: { borderColor: '#B25447' },
  selectedDay: { backgroundColor: '#B25447', borderColor: '#B25447' },
  selectedDayText: { color: '#FFFFFF' },
  diaryDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D26A5C',
  },
  selectedDiaryDot: { backgroundColor: '#FFFFFF' },
  legendDot: { color: '#D26A5C' },
  diaryLegend: {
    marginTop: 10,
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#73737D',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  retryLabel: { fontFamily: 'Jua', fontSize: 14, color: '#D26A5C' },
  actions: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 14,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F0DED6',
  },
  selectionEyebrow: {
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#8D594E',
  },
  selectionDate: {
    fontFamily: 'Jua',
    fontSize: 18,
    lineHeight: 24,
    color: '#433C39',
    marginTop: 4,
    textAlign: 'center',
  },
  selectionHint: {
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 18,
    color: '#756A65',
    marginTop: 6,
    marginBottom: 14,
    textAlign: 'center',
  },
  generateButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#B25447',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  generateLabel: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  notice: {
    marginBottom: 12,
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 20,
    color: '#D26A5C',
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
});
