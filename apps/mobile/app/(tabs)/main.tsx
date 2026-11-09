import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { HomeQuestionEntry } from '../../src/components/home-question-entry';
import { useCallback, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from '../../src/components/app-header';
import { ActionButton } from '../../src/components/action-button';
import { typography } from '../../src/components/typography';
import { useAuth } from '../../src/components/auth-provider';
import { useChildProfile } from '../../src/lib/use-child-profile';
import { createTodoApi } from '../../src/lib/features/todo/todoApi';
import { diaryDateKey } from '../../src/lib/diary-storage';
import type { TodoResponse } from '../../src/lib/features/todo/types';
import { colors } from '../../src/theme/colors';
import { successFeedback } from '../../src/lib/haptics';
import { ScheduleCheck } from '../../src/components/schedule-check';
import { ScheduleProgress } from '../../src/components/schedule-progress';

const localDateKey = diaryDateKey;
export default function MainScreen() {
  const scroll = useRef<ScrollView>(null);
  useTabScrollToTop(scroll);
  const { client, status, epoch } = useAuth();
  const profile = useChildProfile();
  const queryClient = useQueryClient();
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const todos = useQuery({
    queryKey: ['todos', today],
    queryFn: () => createTodoApi(client).getTodos(today),
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
          void queryClient.invalidateQueries({ queryKey: ['todos', date] });
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
    }, [queryClient, status]),
  );

  const schedules = [...(todos.data ?? [])].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      a.scheduledTime.localeCompare(b.scheduledTime) ||
      a.id - b.id,
  );
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
      if (updated.completed) successFeedback();
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
    router.navigate({ pathname: '/todo', params: { date: today } });
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader
        title="안녕하세요"
        subtitle={new Date(`${today}T12:00:00`).toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View>
            {profile.isPending ? (
              <Text style={styles.meta}>아이 정보를 불러오고 있어요.</Text>
            ) : profile.isError ? (
              <View>
                <Text accessibilityRole="alert" style={styles.meta}>
                  아이 정보를 불러오지 못했어요.
                </Text>
                <ActionButton
                  label="아이 정보 다시 시도"
                  secondary
                  onPress={() => void profile.refetch()}
                />
              </View>
            ) : profile.data ? (
              <Text accessibilityRole="header" style={styles.meta}>
                {profile.data.name}의 하루 ·{' '}
                {ageMonths(profile.data.birthday, today)}개월
              </Text>
            ) : (
              <View style={styles.registration}>
                <Text style={styles.meta}>아이와 함께하는 첫 기록</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/children')}
                  style={styles.link}
                >
                  <Text style={styles.linkText}>아이 정보 등록하기</Text>
                </Pressable>
              </View>
            )}
          </View>
          <HomeQuestionEntry />
          <View style={styles.schedule}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.title}>
                오늘의 일정
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={viewAll}
                style={styles.link}
              >
                <Text style={styles.linkText}>전체 일정 보기</Text>
              </Pressable>
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
                  label="일정 다시 불러오기"
                  secondary
                  onPress={() => void todos.refetch()}
                />
              </View>
            ) : (
              <>
                <Text style={styles.meta}>
                  완료 {completed}개 / 전체 {schedules.length}개
                </Text>
                <ScheduleProgress progress={progress} />
                {schedules.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.body}>등록된 일정이 없어요.</Text>
                    <ActionButton
                      label="일정 만들기"
                      secondary
                      onPress={() =>
                        router.navigate({
                          pathname: '/todo',
                          params: { date: today, add: 'true' },
                        })
                      }
                    />
                  </View>
                ) : (
                  <>
                    {completed === schedules.length ? (
                      <Text style={styles.meta}>
                        오늘 일정을 모두 마쳤어요.
                      </Text>
                    ) : null}
                    {schedules.slice(0, 3).map((todo) => (
                      <View
                        key={todo.id}
                        testID="home-schedule-row"
                        style={styles.row}
                      >
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${todo.planName} 완료${todo.completed ? ' 취소' : ''}`}
                          accessibilityState={{
                            checked: todo.completed,
                            disabled: pendingId !== null,
                            busy: pendingId === todo.id,
                          }}
                          disabled={pendingId !== null}
                          onPress={() => void toggle(todo)}
                          style={({ pressed }) => [
                            styles.checkTarget,
                            pressed && styles.pressed,
                          ]}
                        >
                          <ScheduleCheck completed={todo.completed} />
                        </Pressable>
                        <View style={styles.rowCopy}>
                          <Text
                            style={[
                              styles.body,
                              todo.completed && styles.completed,
                            ]}
                          >
                            {todo.planName}
                          </Text>
                          <Text style={styles.meta}>
                            {todo.scheduledTime.slice(0, 5)} ·{' '}
                            {todo.completed
                              ? '완료'
                              : todo.scheduledTime < now
                                ? '시간이 지난 미완료 일정'
                                : '예정'}
                          </Text>
                        </View>
                      </View>
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
                  label="일정 다시 불러오기"
                  secondary
                  onPress={() => {
                    setCompletionError('');
                    void todos.refetch();
                  }}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: { ...typography.section, color: colors.text, flexShrink: 1 },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  meta: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  registration: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  schedule: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkText: { ...typography.label, color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  checkTarget: {
    minWidth: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completed: { textDecorationLine: 'line-through', color: colors.muted },
  pressed: { opacity: 0.7 },
  empty: { paddingVertical: 16, gap: 12 },
  loading: { minHeight: 232 },
  error: { ...typography.caption, color: colors.primary, marginBottom: 8 },
});
