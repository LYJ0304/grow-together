import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { typography } from '../src/components/typography';
import { useChildProfile } from '../src/lib/use-child-profile';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNavigation } from '../src/components/bottom-navigation';
import { RoutineProgress } from '../src/components/routine-progress';
import { useAuth } from '../src/components/auth-provider';
import { createTodoApi } from '../src/lib/features/todo/todoApi';

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const scroll = useRef<ScrollView>(null);
  const [notice, setNotice] = useState('');
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
  const completedCount = schedules.filter((todo) => todo.completed).length;
  const progress =
    schedules.length === 0
      ? 0
      : Math.round((completedCount / schedules.length) * 100);
  const available = status === 'authenticated' && todos.isSuccess;

  useEffect(() => {
    if (notice) scroll.current?.scrollToEnd({ animated: true });
  }, [notice]);

  return (
    <SafeAreaView
      testID={hydrated ? 'main-screen' : undefined}
      edges={['top', 'left', 'right']}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(24, 48 - insets.top) },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {new Date(`${today}T12:00:00`).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </Text>
          {profile.isPending ? (
            <Text style={styles.supporting} accessibilityLiveRegion="polite">
              아이 정보를 불러오고 있어요.
            </Text>
          ) : profile.isError ? (
            <>
              <Text style={styles.supporting} accessibilityRole="alert">
                아이 정보를 불러오지 못했어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void profile.refetch()}
                style={styles.textButton}
              >
                <Text style={styles.link}>아이 정보 다시 시도</Text>
              </Pressable>
            </>
          ) : profile.data ? (
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${profile.data.name}, 함께한 지 +${elapsedDays(profile.data.birthday, today)}일`}
              style={styles.titleRow}
            >
              <Text style={styles.title}>{profile.data.name}의 하루</Text>
              <Text style={styles.elapsed}>
                함께한 지 +{elapsedDays(profile.data.birthday, today)}일
              </Text>
            </View>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                아이와 함께하는 첫 기록
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/children')}
                style={styles.textButton}
              >
                <Text style={styles.link}>아이 정보 등록하기</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.diaryCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.kicker}>작은 순간도 소중한 이야기로</Text>
            <Image
              source={require('../assets/images/diary-book.svg')}
              style={styles.book}
              accessible={false}
              contentFit="contain"
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            오늘의 이야기를 남겨보세요
          </Text>
          <Text style={styles.supporting}>
            함께한 활동과 기억하고 싶은 순간을{'\n'}한 편의 육아 일기로
            담아보세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/calendar')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>일기 작성하기</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              오늘의 루틴
            </Text>
            {available ? (
              <Text style={styles.caption}>
                {completedCount} / {schedules.length} 완료
              </Text>
            ) : null}
          </View>
          {available ? (
            <RoutineProgress progress={progress} />
          ) : (
            <Text style={styles.supporting}>
              오늘의 루틴{' '}
              {status === 'preview'
                ? '미리보기'
                : todos.isError
                  ? '조회 불가'
                  : '불러오는 중'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              오늘의 일정
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/todo')}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.link}>전체 보기 →</Text>
            </Pressable>
          </View>
          <View style={styles.schedule}>
            {status === 'preview' ? (
              <Text style={styles.supporting}>
                미리보기에서는 서버 일정을 이용할 수 없어요.
              </Text>
            ) : todos.isPending ? (
              <Text style={styles.supporting}>일정을 불러오고 있어요.</Text>
            ) : todos.isError ? (
              <>
                <Text style={styles.supporting} accessibilityRole="alert">
                  일정을 불러오지 못했어요.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => void todos.refetch()}
                >
                  <Text style={styles.buttonText}>다시 시도</Text>
                </Pressable>
              </>
            ) : schedules.length === 0 ? (
              <Text style={styles.supporting}>등록된 일정이 없어요.</Text>
            ) : (
              schedules.slice(0, 4).map((todo) => (
                <View
                  key={todo.id}
                  style={styles.scheduleRow}
                  accessible
                  accessibilityLabel={`${todo.scheduledTime.slice(0, 5)} ${todo.planName}, ${todo.completed ? '완료' : '예정'}`}
                >
                  <Text style={styles.scheduleTime}>
                    {todo.scheduledTime.slice(0, 5)}
                  </Text>
                  <Text style={styles.scheduleText}>{todo.planName}</Text>
                  <Text
                    style={[
                      styles.scheduleState,
                      todo.completed && styles.completed,
                    ]}
                  >
                    {todo.completed ? '완료' : '예정'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.memories}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            기록 돌아보기
          </Text>
          <Text style={styles.supporting}>
            차곡차곡 쌓인 우리 아이의 하루를 만나보세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/calendar')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>캘린더에서 돌아보기</Text>
          </Pressable>
        </View>
        {notice ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.notice}
          >
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <BottomNavigation
        active="홈"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onUnavailable={(label) => setNotice(`${label} 화면은 준비 중입니다.`)}
      />
    </SafeAreaView>
  );
}

// Compare calendar dates in UTC so a local 23/25-hour DST day is still one day.
function elapsedDays(birthday: string, today: string) {
  return Math.round((Date.parse(today) - Date.parse(birthday)) / 86_400_000);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 20,
  },
  header: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  eyebrow: { ...typography.caption, color: '#706C69' },
  titleRow: { gap: 4 },
  title: { ...typography.title, color: '#292929', flexShrink: 1 },
  elapsed: { ...typography.title, color: '#B25447' },
  diaryCard: {
    backgroundColor: '#FFF1EC',
    borderWidth: 1,
    borderColor: '#F3DDD4',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
  },
  kicker: { ...typography.caption, color: '#914C41', flexShrink: 1 },
  book: { width: 32, height: 32 },
  supporting: { ...typography.label, color: '#625A56' },
  caption: { ...typography.caption, color: '#706C69' },
  primaryButton: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B25447',
    borderRadius: 12,
    marginTop: 4,
  },
  primaryButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  card: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE8E5',
    borderWidth: 1,
    borderRadius: 20,
    gap: 12,
  },
  cardTitle: { ...typography.section, color: '#292929', flexShrink: 1 },
  schedule: { gap: 4 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE8E5',
  },
  scheduleTime: {
    ...typography.label,
    fontVariant: ['tabular-nums'],
    color: '#706C69',
  },
  scheduleText: {
    ...typography.label,
    color: '#292929',
    flex: 1,
    minWidth: 80,
  },
  scheduleState: { ...typography.caption, color: '#706C69' },
  completed: { color: '#914C41' },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  link: { ...typography.label, color: '#914C41' },
  secondaryButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3EEEB',
    borderRadius: 12,
  },
  buttonText: { ...typography.button, color: '#62524C', textAlign: 'center' },
  memories: { paddingHorizontal: 4, paddingVertical: 4, gap: 12 },
  pressed: { opacity: 0.75 },
  notice: { ...typography.label, color: '#B25447', textAlign: 'center' },
});
