import { CalendarSectionHeader } from '@/components/calendar-section-header';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { CalendarScheduleDay } from '@/components/calendar-schedule-day';
import { useAuth } from '@/components/auth-provider';
import { createTodoApi } from '@/lib/features/todo/todoApi';
import { SafeAreaView } from '@/components/safe-area-view';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTabScrollToTop } from '../../../src/lib/use-tab-scroll-to-top';
import {
  useSessionStore,
  useSessionValue,
} from '../../../src/lib/session-state';
import { useRecordIndex } from '../../../src/lib/use-records';
import {
  calendarDays,
  getWeek,
  shiftCalendarDate,
} from '../../../src/lib/calendar';
import { diaryDateKey, parseDiaryDate } from '../../../src/lib/diary-storage';
import { ActionButton } from '../../../src/components/action-button';
import { RecordCalendar } from '../../../src/components/records/record-calendar';
import { RecordCard } from '../../../src/components/records/record-card';
import { colors } from '../../../src/theme/colors';
import { typography } from '../../../src/theme/typography';

type RecordRow = { date: string };
export default function CalendarScreen() {
  const {
    date: dateParam,
    saved,
    deleted,
    add,
    recommend,
  } = useLocalSearchParams<{
    date?: string;
    saved?: string;
    deleted?: string;
    add?: string;
    recommend?: string;
  }>();
  const { client, status, epoch } = useAuth();
  const [filter, setFilter] = useState<'all' | 'schedule' | 'diary'>('all');
  const [scheduleAction, setScheduleAction] = useState<'add' | 'recommend'>();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const [initialDate] = useState(() => parseDiaryDate(dateParam) ?? new Date());
  const [selected, setSelected] = useSessionValue('calendarDate', initialDate);
  const [month, setMonth] = useSessionValue(
    'calendarMonth',
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [expanded, setExpanded] = useState(true);
  const [notice, setNotice] = useState('');
  const [today, setToday] = useState(() => diaryDateKey(new Date()));
  const list = useRef<FlatList<RecordRow>>(null);
  useTabScrollToTop(list);
  const values = useSessionStore((state) => state.values);
  const dateKey = diaryDateKey(selected),
    monthKey = diaryDateKey(month).slice(0, 7);
  const range = expanded ? calendarDays(month) : getWeek(selected);
  const months = [
    ...new Set(
      range
        .map((day) => diaryDateKey(day).slice(0, 7))
        .filter((key) => /^\d{4}-\d{2}$/.test(key)),
    ),
  ].sort();
  const index = useRecordIndex(months, [dateKey]);
  const scheduleMonths = useQueries({
    queries: months.map((key) => ({
      queryKey: ['todoMonth', epoch, key],
      queryFn: () => createTodoApi(client).getScheduledDates(key),
      enabled: status === 'authenticated',
      retry: false,
      staleTime: 60_000,
    })),
  });
  const scheduledDates = new Set(
    scheduleMonths.flatMap((query) => query.data ?? []),
  );
  const scheduleMonthError = scheduleMonths.some((query) => query.isError);
  const openComposer = () =>
    router.push({
      pathname: '/diary',
      params: { date: dateKey, mode: 'create' },
    });
  const current = index.stateFor(dateKey.slice(0, 7));
  const unavailable = Boolean(current?.isError),
    pending = !current || current.isPending;
  const hasDraft = Object.entries(values).some(
    ([key, value]) =>
      key.startsWith(`diary:${dateKey}:`) &&
      key.endsWith(':dirty') &&
      value === true,
  );
  const hasDiary = index.dates.has(dateKey);
  const rows: RecordRow[] =
    hasDiary && filter !== 'schedule' ? [{ date: dateKey }] : [];
  useEffect(() => {
    const day = parseDiaryDate(dateParam);
    if (!day && add !== 'true' && recommend !== 'true') return;
    if (add === 'true' || recommend === 'true') {
      setFilter('all');
      setScheduleAction(add === 'true' ? 'add' : 'recommend');
    }
    if (day) {
      setSelected(day);
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
    setNotice(
      deleted === 'true'
        ? '일기를 삭제했어요.'
        : saved === 'true'
          ? '일기를 저장했어요.'
          : '',
    );
    router.setParams({
      date: '',
      saved: '',
      deleted: '',
      add: '',
      recommend: '',
    });
  }, [dateParam, saved, deleted, add, recommend, setSelected, setMonth]);
  useEffect(() => {
    if (
      !parseDiaryDate(dateParam) &&
      !expanded &&
      monthKey !== dateKey.slice(0, 7)
    )
      setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [dateParam, expanded, monthKey, dateKey, selected, setMonth]);
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout>;
      const update = () => {
        const now = new Date();
        setToday(diaryDateKey(now));
        clearTimeout(timer);
        timer = setTimeout(
          update,
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
          ).getTime() - now.getTime(),
        );
      };
      update();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') update();
      });
      if (Platform.OS === 'web') window.addEventListener('focus', update);
      return () => {
        clearTimeout(timer);
        subscription.remove();
        if (Platform.OS === 'web') window.removeEventListener('focus', update);
      };
    }, []),
  );
  const chooseDate = useCallback(
    (day: Date) => {
      if (!parseDiaryDate(diaryDateKey(day))) return;
      setSelected(day);
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      setScheduleAction(undefined);
      setNotice('');
    },
    [setSelected, setMonth],
  );
  const step = (offset: number) => {
    setScheduleAction(undefined);
    if (expanded) {
      const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
      const day = new Date(
        next.getFullYear(),
        next.getMonth(),
        Math.min(
          selected.getDate(),
          new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate(),
        ),
      );
      if (!parseDiaryDate(diaryDateKey(day))) return;
      setSelected(day);
      setMonth(next);
      setNotice('');
    } else chooseDate(shiftCalendarDate(selected, offset * 7));
  };
  const openRecord = useCallback(
    (date: string, id?: number) => {
      const day = parseDiaryDate(date);
      if (!day) return;
      setSelected(day);
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      router.push({
        pathname: '/diary',
        params: { date, mode: 'view', ...(id ? { id: String(id) } : {}) },
      });
    },
    [setSelected, setMonth],
  );
  const statusForDate = (date: string): 'loading' | 'error' | 'ready' => {
    const state = index.stateFor(date.slice(0, 7));
    return state?.isError
      ? 'error'
      : !state || state.isPending
        ? 'loading'
        : 'ready';
  };
  const anyError = index.queries.some((query) => query.isError);
  const selectedLabel = selected.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const header = (
    <View>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.title}>
          우리의 하루
        </Text>
      </View>
      <Text style={[styles.meta, styles.intro]}>
        아이와 함께한 하루를 모아보세요.
      </Text>
      <RecordCalendar
        month={month}
        selected={selected}
        today={today}
        expanded={expanded}
        dates={index.dates}
        scheduledDates={scheduledDates}
        statusForDate={statusForDate}
        onExpanded={setExpanded}
        onDate={chooseDate}
        onToday={() => chooseDate(parseDiaryDate(diaryDateKey(new Date()))!)}
        onStep={step}
      />
      <View testID="calendar-selection" style={styles.selection}>
        <Text accessibilityRole="header" style={styles.selectionDate}>
          {selectedLabel}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {unavailable
            ? '조회 실패'
            : pending
              ? '확인 중'
              : `기록 ${hasDiary ? 1 : 0}개`}
        </Text>
      </View>
      <Text style={[styles.meta, styles.intro]}>
        <Text style={styles.scheduleMarker}>●</Text> 일정 ● 기록
      </Text>
      {scheduleMonthError ? (
        <ActionButton
          label="일정 표시 다시 불러오기"
          variant="secondary"
          onPress={() =>
            scheduleMonths
              .filter((query) => query.isError)
              .forEach((query) => void query.refetch())
          }
        />
      ) : null}
      <View style={styles.filters} accessibilityLabel="날짜 상세 필터">
        {(
          [
            { value: 'all', label: '전체' },
            { value: 'schedule', label: '일정' },
            { value: 'diary', label: '기록' },
          ] as const
        ).map(({ value, label }) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[styles.filter, filter === value && styles.switchSelected]}
          >
            <Text
              style={[
                styles.switchText,
                filter === value && styles.switchActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {filter !== 'diary' ? (
        <CalendarScheduleDay
          key={`${epoch}:${dateKey}`}
          dateKey={dateKey}
          action={scheduleAction}
          onActionHandled={() => setScheduleAction(undefined)}
        />
      ) : null}
      {filter !== 'schedule' ? (
        <View style={styles.recordHeading}>
          <CalendarSectionHeader
            title="기록"
            action={
              !hasDiary && !pending && !unavailable
                ? {
                    label: hasDraft ? '이어서 쓰기' : '일기 작성하기',
                    accessibilityLabel: hasDraft
                      ? '작성하던 일기 이어 쓰기'
                      : '선택한 날짜의 일기 작성하기',
                    onPress: openComposer,
                  }
                : undefined
            }
          />
        </View>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {anyError ? (
        <View style={styles.message}>
          <Text accessibilityRole="alert" style={styles.error}>
            일기 목록을 불러오지 못했어요.
          </Text>
          <ActionButton
            label="일기 목록 다시 불러오기"
            variant="secondary"
            onPress={index.retry}
          />
        </View>
      ) : null}
    </View>
  );
  const empty =
    filter === 'schedule' ? null : (
      <View style={styles.message}>
        {pending ? (
          <Text accessibilityLiveRegion="polite" style={styles.meta}>
            기록을 불러오는 중이에요.
          </Text>
        ) : unavailable ? (
          <ActionButton
            label="선택한 날짜의 일기 확인"
            disabled
            variant="secondary"
            onPress={() => {}}
          />
        ) : (
          <>
            <Text style={styles.body}>
              {hasDraft
                ? '작성하던 일기가 있어요'
                : '이날의 기록이 아직 없어요'}
            </Text>
            <Text style={styles.meta}>
              {hasDraft
                ? '이 세션에서 작성하던 내용을 이어갈 수 있어요.'
                : '함께한 작은 순간을 기록으로 남겨보세요.'}
            </Text>
          </>
        )}
      </View>
    );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      {hydrated ? (
        <FlatList<RecordRow>
          ref={list}
          testID="records-list"
          data={rows}
          keyExtractor={(item) => item.date}
          ListHeaderComponent={header}
          ListEmptyComponent={empty ?? undefined}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <RecordCard
                date={item.date}
                visible
                selected
                disabled={unavailable}
                onOpen={openRecord}
              />
            </View>
          )}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <Text style={styles.meta}>캘린더를 불러오는 중이에요.</Text>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  intro: { paddingHorizontal: 10, paddingBottom: 6 },
  filters: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  filter: {
    minHeight: 44,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  recordHeading: { marginHorizontal: 10, marginTop: 8 },
  scheduleMarker: { color: colors.primary },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  title: {
    ...typography.section,
    fontSize: 24,
    lineHeight: 32,
    color: colors.heading,
  },
  switchSelected: { backgroundColor: colors.surface },
  switchText: { ...typography.label, color: colors.muted },
  switchActive: { color: colors.primary, fontWeight: '600' },
  selection: {
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectionDate: { ...typography.button, color: colors.heading },
  count: { ...typography.caption, color: colors.muted },
  cardWrap: { paddingHorizontal: 10 },
  message: { paddingHorizontal: 10, paddingVertical: 12, gap: 10 },
  body: { ...typography.body, color: colors.heading },
  meta: { ...typography.caption, color: colors.muted },
  error: { ...typography.caption, color: colors.danger },
  notice: {
    ...typography.caption,
    color: colors.primary,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
});
