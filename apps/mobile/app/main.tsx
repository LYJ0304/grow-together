import { HomeQuestionEntry } from '../src/components/home-question-entry';
import { useCallback, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { BottomNavigation } from '../src/components/bottom-navigation';
import { AppHeader } from '../src/components/app-header';
import { ActionButton } from '../src/components/action-button';
import { RecommendationOptions } from '../src/components/recommendation-options';
import { typography } from '../src/components/typography';
import { useAuth } from '../src/components/auth-provider';
import { useChildProfile } from '../src/lib/use-child-profile';
import { createTodoApi } from '../src/lib/features/todo/todoApi';
import { diaryDateKey } from '../src/lib/diary-storage';
import { useSessionStore } from '../src/lib/session-state';

const localDateKey = diaryDateKey;
export default function MainScreen() {
  const scroll = useRef<ScrollView>(null);
  const { client, status } = useAuth();
  const profile = useChildProfile();
  const queryClient = useQueryClient();
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const todos = useQuery({
    queryKey: ['todos', today],
    queryFn: () => createTodoApi(client).getTodos(today),
    enabled: status === 'authenticated',
    retry: false,
  });
  const values = useSessionStore((state) => state.values);
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

  const schedules = [...(todos.data ?? [])].sort((a, b) =>
    a.scheduledTime.localeCompare(b.scheduledTime),
  );
  const now = new Date().toTimeString().slice(0, 8);
  const next =
    schedules.find((todo) => !todo.completed && todo.scheduledTime >= now) ??
    schedules.find((todo) => !todo.completed);
  const hasDraft = Object.entries(values).some(
    ([key, value]) =>
      key.startsWith(`diary:${today}:`) &&
      key.endsWith(':dirty') &&
      value === true,
  );
  const diaryLabel = hasDraft
    ? '작성하던 일기 이어 쓰기'
    : schedules.some((todo) => todo.completed)
      ? '오늘 함께한 일을 일기로 남겨볼까요?'
      : '오늘의 순간을 남겨볼까요?';
  const add = () =>
    router.push({ pathname: '/todo', params: { date: today, add: 'true' } });
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <Text style={styles.meta}>
          {new Date(`${today}T12:00:00`).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </Text>
        <HomeQuestionEntry />
        {profile.isPending ? (
          <Text style={styles.body}>아이 정보를 불러오고 있어요.</Text>
        ) : profile.isError ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.body}>
              아이 정보를 불러오지 못했어요.
            </Text>
            <ActionButton
              label="아이 정보 다시 시도"
              onPress={() => void profile.refetch()}
              secondary
            />
          </View>
        ) : profile.data ? (
          <Text accessibilityRole="header" style={styles.title}>
            {profile.data.name}의 하루 ·{' '}
            {ageMonths(profile.data.birthday, today)}개월
          </Text>
        ) : (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              아이와 함께하는 첫 기록
            </Text>
            <ActionButton
              label="아이 정보 등록하기"
              onPress={() => router.push('/children')}
            />
          </View>
        )}
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            다음에 할 활동
          </Text>
          {status === 'preview' ? (
            <Text style={styles.body}>
              미리보기에서는 서버 일정을 이용할 수 없어요.
            </Text>
          ) : todos.isPending ? (
            <Text style={styles.body}>일정을 불러오고 있어요.</Text>
          ) : todos.isError ? (
            <>
              <Text accessibilityRole="alert" style={styles.body}>
                일정을 불러오지 못했어요.
              </Text>
              <ActionButton
                label="일정 다시 불러오기"
                onPress={() => void todos.refetch()}
              />
            </>
          ) : next ? (
            <>
              <Text style={styles.title}>{next.planName}</Text>
              <Text style={styles.body}>
                {next.scheduledTime.slice(0, 5)} ·{' '}
                {next.scheduledTime < now ? '시간이 지난 미완료 일정' : '예정'}
              </Text>
              {next.content ? (
                <Text style={styles.body}>{next.content}</Text>
              ) : null}
              <ActionButton
                label="일정 확인하고 실행하기"
                onPress={() =>
                  router.push({ pathname: '/todo', params: { date: today } })
                }
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {schedules.length
                  ? '오늘 계획한 활동을 마쳤어요. 다음 활동은 가볍게 골라보세요.'
                  : '등록된 일정이 없어요. 오늘 함께할 활동을 정해볼까요?'}
              </Text>
              <ActionButton
                label="직접 일정 추가"
                onPress={add}
                disabled={status !== 'authenticated'}
              />
              <RecommendationOptions onDirect={add} />
            </>
          )}
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            오늘 일정 요약
          </Text>
          {status === 'authenticated' && todos.isSuccess ? (
            <>
              <Text style={styles.body}>
                예정 {schedules.filter((todo) => !todo.completed).length}개 ·
                완료 {schedules.filter((todo) => todo.completed).length}개
              </Text>
              {schedules.slice(0, 3).map((todo) => (
                <Text key={todo.id} style={styles.body}>
                  {todo.scheduledTime.slice(0, 5)} · {todo.planName} ·{' '}
                  {todo.completed ? '완료' : '예정'}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.meta}>
              {todos.isError
                ? '조회 실패 · 다시 불러와 주세요.'
                : '일정 확인 후 요약을 보여드려요.'}
            </Text>
          )}
          <ActionButton
            label="전체 일정 보기"
            onPress={() =>
              router.push({ pathname: '/todo', params: { date: today } })
            }
            secondary
          />
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {diaryLabel}
          </Text>
          <Text style={styles.body}>
            함께한 활동과 기억하고 싶은 순간을 직접 다듬어 남겨보세요.
          </Text>
          <ActionButton
            label={hasDraft ? '작성하던 일기 이어 쓰기' : '일기 작성하기'}
            onPress={() =>
              router.push({ pathname: '/diary', params: { date: today } })
            }
            secondary
          />
          <ActionButton
            label="기록 캘린더 보기"
            onPress={() => router.replace('/calendar')}
            secondary
          />
        </View>
      </ScrollView>
      <BottomNavigation
        active="오늘"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
      />
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
  screen: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    padding: 20,
    gap: 18,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  card: {
    padding: 20,
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEE8E5',
  },
  title: { ...typography.title, color: '#433C39', flexShrink: 1 },
  body: { ...typography.body, color: '#494442' },
  meta: { ...typography.caption, color: '#625B57' },
});
