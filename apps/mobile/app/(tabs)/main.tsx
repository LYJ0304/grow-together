import { TodoReactionModal } from '../../src/components/todo-reaction-modal';
import { HomeScheduleRow } from '../../src/components/home-schedule-row';
import { MotionPressable } from '../../src/components/motion-pressable';
import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { HomeQuickAdd } from '../../src/components/home-quick-add';
import { editorial } from '../../src/theme/editorial';
import { HomeQuestionEntry } from '../../src/components/home-question-entry';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { HomeDayHeader } from '../../src/components/home-day-header';
import { HomeMoments } from '../../src/components/home-moments';
import { createDiaryApi } from '../../src/lib/features/diary/diaryApi';
import { ApiError } from '../../src/lib/api/errors';
import { ActionButton } from '../../src/components/action-button';
import { typography } from '../../src/components/typography';
import { useAuth } from '../../src/components/auth-provider';
import { useChildProfile } from '../../src/lib/use-child-profile';
import { createTodoApi } from '../../src/lib/features/todo/todoApi';
import { diaryDateKey } from '../../src/lib/diary-storage';
import type { TodoResponse } from '../../src/lib/features/todo/types';
import { colors } from '../../src/theme/colors';
import { successFeedback } from '../../src/lib/haptics';
import { ScheduleProgress } from '../../src/components/schedule-progress';

const localDateKey = diaryDateKey;
const QUICK_ADD_SIZE = 56;
const QUICK_ADD_BOTTOM = 16;
export default function MainScreen() {
  const scroll = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const quickButton = useRef<View>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  useTabScrollToTop(scroll);
  const { client, status, epoch } = useAuth();
  const profile = useChildProfile();
  const queryClient = useQueryClient();
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const diary = useQuery({
    queryKey: ['diaryByDate', epoch, date],
    enabled: status === 'authenticated',
    retry: false,
    queryFn: async () => {
      try {
        return await createDiaryApi(client).getByDate(date);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const todos = useQuery({
    queryKey: ['todos', date],
    queryFn: () => createTodoApi(client).getTodos(date),
    enabled: status === 'authenticated',
    retry: false,
  });
  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' && status !== 'preview') return;
      let timer: ReturnType<typeof setTimeout>;
      const refresh = () => {
        const now = new Date();
        const date = localDateKey(now);
        setToday(date);
        if (status === 'authenticated')
          void queryClient.invalidateQueries({
            queryKey: ['todos', selectedDate ?? date],
          });
        if (status === 'authenticated')
          void queryClient.invalidateQueries({
            queryKey: ['diaryByDate', epoch, selectedDate ?? date],
          });
        clearTimeout(timer);
        const midnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
        );
        timer = setTimeout(refresh, midnight.getTime() - now.getTime());
      };
      refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      if (Platform.OS === 'web') window.addEventListener('focus', refresh);
      return () => {
        clearTimeout(timer);
        subscription.remove();
        if (Platform.OS === 'web') window.removeEventListener('focus', refresh);
      };
    }, [queryClient, status, epoch, selectedDate]),
  );

  const schedules = [...(todos.data ?? [])].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      a.scheduledTime.localeCompare(b.scheduledTime) ||
      a.id - b.id,
  );
  const [hasShownSchedules, setHasShownSchedules] = useState(false);
  useEffect(() => {
    if (todos.data?.length) setHasShownSchedules(true);
  }, [todos.data]);
  const completed = schedules.filter((todo) => todo.completed).length;
  const progress = schedules.length
    ? Math.round((completed / schedules.length) * 100)
    : 0;
  const [now, setNow] = useState(() => new Date().toTimeString().slice(0, 8));
  useFocusEffect(
    useCallback(() => {
      const update = () => setNow(new Date().toTimeString().slice(0, 8));
      update();
      const timer = setInterval(update, 60_000);
      return () => clearInterval(timer);
    }, []),
  );
  const [reactionTodo, setReactionTodo] = useState<TodoResponse | null>(null);
  useEffect(() => {
    setReactionTodo(null);
  }, [epoch]);
  const [completionError, setCompletionError] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);
  const pending = useRef(false);
  const toggle = async (todo: TodoResponse) => {
    if (pending.current || status !== 'authenticated') return;
    pending.current = true;
    setPendingId(todo.id);
    setCompletionError('');
    try {
      const updated = await createTodoApi(client).setCompletion(
        todo.id,
        !todo.completed,
      );
      // The session request rejects stale responses; do not write after a session change.
      if (client.getSnapshot().epoch !== epoch) return;
      queryClient.setQueryData<TodoResponse[]>(
        ['todos', todo.scheduledDate],
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      await queryClient.invalidateQueries({
        queryKey: ['todos', todo.scheduledDate],
      });
      if (client.getSnapshot().epoch !== epoch) return;
      if (updated.completed) {
        successFeedback();
        setReactionTodo(updated);
      }
    } catch {
      if (client.getSnapshot().epoch === epoch)
        setCompletionError(
          '완료 상태를 저장하지 못했어요. 목록을 다시 불러와 상태를 확인해주세요.',
        );
    } finally {
      pending.current = false;
      setPendingId(null);
    }
  };
  const viewAll = () =>
    router.navigate({ pathname: '/todo', params: { date } });
  const hasDiary = diary.data?.id != null;
  const diaryLabel =
    status === 'preview'
      ? '일기 미리보기'
      : diary.isError
        ? '일기 다시 확인'
        : diary.isPending
          ? '일기 확인 중'
          : `일기 ${hasDiary ? 1 : 0}개`;
  const openDiary = () =>
    router.navigate({
      pathname: '/diary',
      params: {
        date,
        ...(hasDiary ? { id: String(diary.data!.id), mode: 'view' } : {}),
      },
    });
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      {reactionTodo ? (
        <TodoReactionModal
          key={reactionTodo.id}
          todo={reactionTodo}
          onClose={() => setReactionTodo(null)}
        />
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <HomeDayHeader
            date={date}
            today={today}
            blocked={pendingId !== null}
            onChangeDate={(next) => {
              setSelectedDate(next === today ? null : next);
              setCompletionError('');
            }}
          />
          <View>
            {profile.isPending ? (
              <Text style={styles.meta}>아이 정보를 불러오고 있어요.</Text>
            ) : profile.isError ? (
              <View>
                <Text accessibilityRole="alert" style={styles.meta}>
                  아이 정보를 불러오지 못했어요.
                </Text>
                <ActionButton
                  motionEnabled
                  label="아이 정보 다시 시도"
                  variant="secondary"
                  onPress={() => void profile.refetch()}
                />
              </View>
            ) : profile.data ? (
              <Text accessibilityRole="header" style={styles.meta}>
                {profile.data.name}의 하루 ·{' '}
                {ageMonths(profile.data.birthday, date)}개월
              </Text>
            ) : (
              <View style={styles.registration}>
                <Text style={styles.meta}>아이와 함께하는 첫 기록</Text>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      status === 'authenticated' ? '/onboarding' : '/children',
                    )
                  }
                  style={styles.link}
                >
                  <Text style={styles.linkText}>아이 정보 등록하기</Text>
                </MotionPressable>
              </View>
            )}
          </View>
          <View style={styles.summaryRow}>
            {[
              {
                label: '계획한 활동',
                value:
                  status === 'preview'
                    ? '—'
                    : todos.isError || todos.isPending
                      ? '—'
                      : String(schedules.length),
                onPress: viewAll,
                name:
                  status === 'preview'
                    ? '일정 미리보기'
                    : todos.isError
                      ? '일정 확인하기'
                      : todos.isPending
                        ? '일정 확인 중'
                        : `일정 ${schedules.length}개`,
              },
              {
                label: '완료한 활동',
                value:
                  status === 'preview' || todos.isError || todos.isPending
                    ? '—'
                    : String(completed),
                onPress: viewAll,
                name: '완료한 활동 보기',
              },
              {
                label: '남긴 일기',
                value:
                  status === 'preview' || diary.isPending || diary.isError
                    ? '—'
                    : hasDiary
                      ? '1'
                      : '0',
                onPress: () =>
                  diary.isError ? void diary.refetch() : openDiary(),
                name: diaryLabel,
              },
            ].map((metric) => (
              <MotionPressable
                key={metric.label}
                accessibilityRole="button"
                accessibilityLabel={metric.name}
                onPress={metric.onPress}
                style={styles.metric}
              >
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </MotionPressable>
            ))}
          </View>
          <View style={editorial.hero}>
            <Text style={editorial.eyebrow}>OUR DAILY MOMENT</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              하루의 작은 순간을{'\n'}함께 기록해요.
            </Text>
            <Text style={editorial.description}>
              함께한 활동과 기억하고 싶은 마음을 남겨주세요.
            </Text>
            <MotionPressable
              accessibilityRole="button"
              onPress={openDiary}
              style={styles.journalLink}
            >
              <Text style={styles.journalLinkText}>
                {hasDiary ? '선택한 날 일기 보기' : '선택한 날 일기 남기기'} ›
              </Text>
            </MotionPressable>
          </View>
          <HomeMoments
            diaryText={
              status === 'preview'
                ? '기록에서 확인'
                : diary.isError
                  ? '불러오기 실패'
                  : diary.isPending
                    ? '확인 중'
                    : `일기 ${hasDiary ? 1 : 0}개 · 사진 ${diary.data?.diaryFiles?.length ?? 0}장`
            }
            activitiesText={
              status === 'preview'
                ? '일정에서 확인'
                : todos.isError
                  ? '불러오기 실패'
                  : todos.isPending
                    ? '확인 중'
                    : `${completed}개`
            }
            onDiaryPress={() =>
              diary.isError ? void diary.refetch() : openDiary()
            }
            onActivitiesPress={viewAll}
          />
          <View style={styles.schedule}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.title}>
                {date === today ? '오늘의 일정' : '이날의 일정'}
              </Text>
              <MotionPressable
                accessibilityRole="button"
                onPress={viewAll}
                style={styles.link}
              >
                <Text style={styles.linkText}>전체 일정 보기</Text>
              </MotionPressable>
            </View>
            {status === 'preview' ? (
              <Text style={styles.body}>
                미리보기에서는 서버 일정을 이용할 수 없어요.
              </Text>
            ) : todos.isPending ? (
              <View style={styles.loading}>
                <Text style={styles.meta}>일정을 불러오고 있어요.</Text>
              </View>
            ) : todos.isError ? (
              <View>
                <Text accessibilityRole="alert" style={styles.body}>
                  일정을 불러오지 못했어요.
                </Text>
                <ActionButton
                  motionEnabled
                  label="일정 다시 불러오기"
                  variant="secondary"
                  onPress={() => void todos.refetch()}
                />
              </View>
            ) : (
              <>
                <Text style={styles.meta}>
                  완료 {completed}개 / 전체 {schedules.length}개
                </Text>
                <ScheduleProgress
                  progress={progress}
                  accessibilityLabel={
                    date === today
                      ? '오늘 일정 완료율'
                      : '선택한 날 일정 완료율'
                  }
                />
                {schedules.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.body}>등록된 일정이 없어요.</Text>
                    <ActionButton
                      motionEnabled
                      label="일정 만들기"
                      variant="primary"
                      onPress={() =>
                        router.navigate({
                          pathname: '/todo',
                          params: { date, add: 'true' },
                        })
                      }
                    />
                  </View>
                ) : (
                  <>
                    {completed === schedules.length ? (
                      <Text style={styles.meta}>
                        {date === today
                          ? '오늘 일정을 모두 마쳤어요.'
                          : '이날 일정을 모두 마쳤어요.'}
                      </Text>
                    ) : null}
                    {schedules.slice(0, 3).map((todo, index) => (
                      <HomeScheduleRow
                        key={todo.id}
                        todo={todo}
                        index={index}
                        entrance={!hasShownSchedules}
                        now={date < today ? '23:59:59' : now}
                        pendingId={pendingId}
                        onToggle={() => void toggle(todo)}
                        onReaction={() => setReactionTodo(todo)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
            {completionError ? (
              <View>
                <Text accessibilityRole="alert" style={styles.error}>
                  {completionError}
                </Text>
                <ActionButton
                  motionEnabled
                  label="일정 다시 불러오기"
                  variant="secondary"
                  onPress={() => {
                    setCompletionError('');
                    void todos.refetch();
                  }}
                />
              </View>
            ) : null}
          </View>
          <HomeQuestionEntry currentDay={date === today} />
        </ScrollView>
      </KeyboardAvoidingView>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={
          hasDiary ? '선택한 날 일기 열기' : '선택한 날 일기 작성하기'
        }
        ref={quickButton}
        onPress={() => setQuickOpen(true)}
        style={[
          styles.fab,
          { right: Math.max(insets.right + 20, (width - 600) / 2 + 20) },
        ]}
      >
        <Text accessible={false} style={styles.fabText}>
          +
        </Text>
      </MotionPressable>
      {quickOpen ? (
        <HomeQuickAdd
          authenticated={status === 'authenticated'}
          onClose={() => {
            setQuickOpen(false);
            requestAnimationFrame(() => quickButton.current?.focus());
          }}
          onDiary={() => {
            setQuickOpen(false);
            openDiary();
          }}
          onSchedule={() => {
            setQuickOpen(false);
            router.navigate({
              pathname: '/todo',
              params: { date, add: 'true' },
            });
          }}
          onRecommend={() => {
            setQuickOpen(false);
            router.navigate({
              pathname: '/todo',
              params: { date, recommend: 'true' },
            });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ageMonths(birthday: string, today: string) {
  const born = new Date(`${birthday}T12:00:00`),
    date = new Date(`${today}T12:00:00`);
  return Math.max(
    0,
    (date.getFullYear() - born.getFullYear()) * 12 +
      date.getMonth() -
      born.getMonth() -
      (date.getDate() < born.getDate() ? 1 : 0),
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    paddingTop: 8,
    // End-of-scroll clearance, without shrinking the scrolling viewport.
    paddingBottom: QUICK_ADD_SIZE + QUICK_ADD_BOTTOM + 24,
    gap: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  metric: {
    ...editorial.card,
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    minHeight: 80,
  },
  metricValue: { ...editorial.title, fontSize: 24, lineHeight: 30 },
  metricLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  heroTitle: { ...editorial.section, fontSize: 23, lineHeight: 34 },
  journalLink: { minHeight: 44, justifyContent: 'center' },
  journalLinkText: {
    ...typography.label,
    color: colors.onTint,
    fontWeight: '700',
  },
  summaryRow: { flexDirection: 'row', gap: 10 },
  fab: {
    position: 'absolute',
    bottom: QUICK_ADD_BOTTOM,
    width: QUICK_ADD_SIZE,
    height: QUICK_ADD_SIZE,
    borderRadius: 28,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.heading,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { fontSize: 32, color: colors.onTint },
  title: { ...typography.section, color: colors.heading, flexShrink: 1 },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  meta: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  registration: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  schedule: { gap: 12, paddingHorizontal: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { ...typography.label, fontWeight: '600', color: colors.primary },
  empty: { paddingVertical: 12, gap: 14 },
  loading: { minHeight: 232 },
  error: { ...typography.caption, color: colors.danger, marginBottom: 8 },
});
