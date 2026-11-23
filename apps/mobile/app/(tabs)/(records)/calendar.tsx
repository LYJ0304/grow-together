import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListViewToken,
} from 'react-native';
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
import { AppHeader } from '../../../src/components/app-header';
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
  } = useLocalSearchParams<{
    date?: string;
    saved?: string;
    deleted?: string;
  }>();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const [initialDate] = useState(() => parseDiaryDate(dateParam) ?? new Date());
  const [selected, setSelected] = useSessionValue('calendarDate', initialDate);
  const [month, setMonth] = useSessionValue(
    'calendarMonth',
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [view, setView] = useSessionValue<'calendar' | 'list'>(
    'recordsView',
    'calendar',
  );
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const [today, setToday] = useState(() => diaryDateKey(new Date()));
  const list = useRef<FlatList<RecordRow>>(null);
  useTabScrollToTop(list);
  const values = useSessionStore((state) => state.values);
  const dateKey = diaryDateKey(selected),
    monthKey = diaryDateKey(month).slice(0, 7);
  const range =
    view === 'list'
      ? [month]
      : expanded
        ? calendarDays(month, 1)
        : getWeek(selected, 1);
  const months = [
    ...new Set(
      range
        .map((day) => diaryDateKey(day).slice(0, 7))
        .filter((key) => /^\d{4}-\d{2}$/.test(key)),
    ),
  ].sort();
  const [visibleDates, setVisibleDates] = useState<Set<string>>(
    () => new Set(),
  );
  const index = useRecordIndex(months, [...visibleDates]);
  const dateKeys = [...index.dates].sort().join('|');
  const rows = useMemo<RecordRow[]>(() => {
    const keys = dateKeys ? dateKeys.split('|') : [];
    return (
      view === 'calendar'
        ? keys.filter((key) => key === dateKey)
        : keys
            .filter((key) => key.startsWith(monthKey))
            .sort((a, b) => b.localeCompare(a))
    ).map((date) => ({ date }));
  }, [dateKeys, view, dateKey, monthKey]);
  const current = index.stateFor(
    view === 'calendar' ? dateKey.slice(0, 7) : monthKey,
  );
  const unavailable = Boolean(current?.isError),
    pending = !current || current.isPending;
  const hasDraft = Object.entries(values).some(
    ([key, value]) =>
      key.startsWith(`diary:${dateKey}:`) &&
      key.endsWith(':dirty') &&
      value === true,
  );
  const hasDiary = index.dates.has(dateKey);
  const monthCount = [...index.dates].filter((key) =>
    key.startsWith(monthKey),
  ).length;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      const dates = new Set<string>(
        viewableItems
          .filter((item) => item.isViewable)
          .map((item) => item.item.date),
      );
      setVisibleDates((old) =>
        old.size === dates.size && [...old].every((date) => dates.has(date))
          ? old
          : dates,
      );
    },
  ).current;
  useEffect(() => {
    const day = parseDiaryDate(dateParam);
    if (!day) return;
    setSelected(day);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setExpanded(false);
    setNotice(
      deleted === 'true'
        ? '일기를 삭제했어요.'
        : saved === 'true'
          ? '일기를 저장했어요.'
          : '',
    );
    router.setParams({ date: '', saved: '', deleted: '' });
  }, [dateParam, saved, deleted, setSelected, setMonth]);
  useEffect(() => {
    if (
      !parseDiaryDate(dateParam) &&
      view === 'calendar' &&
      !expanded &&
      monthKey !== dateKey.slice(0, 7)
    )
      setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [dateParam, view, expanded, monthKey, dateKey, selected, setMonth]);
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
      setExpanded(false);
      setNotice('');
    },
    [setSelected, setMonth],
  );
  const step = (offset: number) => {
    if (view === 'list' || expanded) {
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
          우리의 기록
        </Text>
        <View
          role="group"
          accessibilityLabel="기록 보기 방식"
          style={styles.switch}
        >
          {(
            [
              { key: 'calendar', label: '캘린더' },
              { key: 'list', label: '모아보기' },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              aria-pressed={view === item.key}
              accessibilityState={{ selected: view === item.key }}
              onPress={() => {
                setView(item.key);
                setExpanded(false);
              }}
              style={styles.switchTarget}
            >
              <View
                style={[
                  styles.switchFace,
                  view === item.key && styles.switchSelected,
                ]}
              >
                <Text
                  style={[
                    styles.switchText,
                    view === item.key && styles.switchActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <RecordCalendar
        month={month}
        selected={selected}
        today={today}
        expanded={expanded}
        list={view === 'list'}
        dates={index.dates}
        statusForDate={statusForDate}
        onExpanded={setExpanded}
        onDate={chooseDate}
        onToday={() => chooseDate(parseDiaryDate(diaryDateKey(new Date()))!)}
        onStep={step}
      />
      <View testID="calendar-selection" style={styles.selection}>
        <Text accessibilityRole="header" style={styles.selectionDate}>
          {view === 'calendar' ? selectedLabel : '이번 달의 기록'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {unavailable
            ? '조회 실패'
            : pending
              ? '확인 중'
              : `기록 ${view === 'calendar' ? (hasDiary ? 1 : 0) : monthCount}개`}
        </Text>
      </View>
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
  const empty = (
    <View style={styles.message}>
      {pending ? (
        <Text accessibilityLiveRegion="polite" style={styles.meta}>
          기록을 불러오는 중이에요.
        </Text>
      ) : unavailable ? (
        view === 'calendar' ? (
          <ActionButton
            label="선택한 날짜의 일기 확인"
            disabled
            variant="secondary"
            onPress={() => {}}
          />
        ) : null
      ) : view === 'list' ? (
        <>
          <Text style={styles.body}>이번 달에 저장된 일기가 없어요.</Text>
          <Text style={styles.meta}>
            다른 달을 살펴보거나 캘린더에서 하루를 선택해보세요.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            {hasDraft ? '작성하던 일기가 있어요' : '이날의 기록이 아직 없어요'}
          </Text>
          <Text style={styles.meta}>
            {hasDraft
              ? '이 세션에서 작성하던 내용을 이어갈 수 있어요.'
              : '함께한 작은 순간을 기록으로 남겨보세요.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasDraft
                ? '작성하던 일기 이어 쓰기'
                : '선택한 날짜의 일기 작성하기'
            }
            onPress={() =>
              router.push({
                pathname: '/diary',
                params: { date: dateKey, mode: 'create' },
              })
            }
            style={({ pressed }) => [styles.create, pressed && styles.pressed]}
          >
            <Text style={styles.createLabel}>
              {hasDraft ? '작성하던 일기 이어 쓰기' : '일기 작성하기'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader />
      {hydrated ? (
        <FlatList<RecordRow>
          ref={list}
          testID="records-list"
          data={rows}
          keyExtractor={(item) => item.date}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <RecordCard
                date={item.date}
                visible={visibleDates.has(item.date)}
                selected={view === 'calendar'}
                disabled={unavailable}
                onOpen={openRecord}
              />
            </View>
          )}
          onViewableItemsChanged={onViewableItemsChanged}
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
  switch: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 12,
  },
  switchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchFace: {
    minHeight: 36,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 10,
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
  create: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createLabel: { ...typography.button, color: colors.onTint },
  pressed: { backgroundColor: colors.secondaryPressed },
});
