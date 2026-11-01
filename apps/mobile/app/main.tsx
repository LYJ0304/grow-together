import { StatusBar } from 'expo-status-bar';
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
  useWindowDimensions,
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
  const { width, fontScale } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const stacked = !hydrated || width < 360 || fontScale > 1.2;
  const scroll = useRef<ScrollView>(null);
  const [notice, setNotice] = useState('');
  const { client, status } = useAuth();
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
      if (status !== 'authenticated') return;
      let timer: ReturnType<typeof setTimeout>;
      const refresh = () => {
        const now = new Date();
        const date = localDateKey(now);
        setToday(date);
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
  const progress =
    schedules.length === 0
      ? 0
      : Math.round(
          (schedules.filter((todo) => todo.completed).length /
            schedules.length) *
            100,
        );
  const available = status === 'authenticated' && todos.isSuccess;

  useEffect(() => {
    if (notice) scroll.current?.scrollToEnd({ animated: true });
  }, [notice]);

  // shortcut: Child details and AI copy remain Figma samples until their API integration is requested.
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
          <Text style={styles.eyebrow}>아이와 함께하는 오늘</Text>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="사랑둥이와 함께한 지 +378일"
            style={styles.titleRow}
          >
            <Text style={styles.title}>사랑둥이와 함께한 지</Text>
            <Text style={styles.elapsed}>
              +378<Text style={styles.day}>일</Text>
            </Text>
          </View>
        </View>

        <View style={styles.routineCard}>
          {available ? (
            <RoutineProgress progress={progress} />
          ) : (
            <Text style={styles.tipText}>
              오늘의 루틴{' '}
              {status === 'preview'
                ? '미리보기'
                : todos.isError
                  ? '조회 불가'
                  : '불러오는 중'}
            </Text>
          )}
          <View style={styles.tip}>
            <Text style={styles.tipText}>
              오늘은 햇살이 좋아요 ☀️ 15분 산책을 추천해요
            </Text>
          </View>
        </View>

        <View style={[styles.cards, stacked && styles.stacked]}>
          <View style={[styles.detailCard, stacked && styles.stackedCard]}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              오늘의 일정
            </Text>
            <View style={styles.schedule}>
              {status === 'preview' ? (
                <Text>미리보기에서는 서버 일정을 이용할 수 없어요.</Text>
              ) : todos.isPending ? (
                <Text>일정을 불러오고 있어요.</Text>
              ) : todos.isError ? (
                <>
                  <Text accessibilityRole="alert">
                    일정을 불러오지 못했어요.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.cardButton}
                    onPress={() => void todos.refetch()}
                  >
                    <Text>다시 시도</Text>
                  </Pressable>
                </>
              ) : schedules.length === 0 ? (
                <Text>등록된 일정이 없어요.</Text>
              ) : (
                schedules.slice(0, 4).map((todo) => (
                  <View key={todo.id} style={styles.scheduleRow}>
                    <Text style={styles.scheduleTime}>
                      {todo.scheduledTime.slice(0, 5)}
                    </Text>
                    <Text style={styles.scheduleText}>{todo.planName}</Text>
                  </View>
                ))
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/todo')}
              style={({ pressed }) => [
                styles.cardButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cardButtonText}>전체 보기 →</Text>
            </Pressable>
          </View>
          <View style={[styles.detailCard, stacked && styles.stackedCard]}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              AI 일기
            </Text>
            <View style={styles.diary}>
              <Text style={styles.diaryText}>
                오늘은 낮잠을 1.5h 자며 안정적인 하루를 보냈어요.
              </Text>
              <Text style={styles.diarySupporting}>
                저녁엔 짧은 독서 1권 추천📖
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/calendar')}
              style={({ pressed }) => [
                styles.cardButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.cardButtonText, styles.diaryButtonText]}>
                만들러 가기
              </Text>
            </Pressable>
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
  },
  header: { gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  eyebrow: { fontSize: 14, lineHeight: 22, color: '#706C69' },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 6,
  },
  title: {
    maxWidth: '100%',
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 36,
    color: '#292929',
  },
  elapsed: {
    maxWidth: '100%',
    fontFamily: 'Jua',
    color: '#D26A5C',
    fontSize: 30,
    lineHeight: 36,
  },
  day: { fontSize: 23 },
  routineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE8E5',
    borderRadius: 24,
    padding: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  tip: {
    alignSelf: 'stretch',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF1EC',
    borderRadius: 12,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 21,
    color: '#62524C',
    textAlign: 'center',
  },
  cards: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  stacked: { flexDirection: 'column' },
  stackedCard: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  detailCard: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderColor: '#EEE8E5',
    borderWidth: 1,
    borderRadius: 20,
    gap: 16,
  },
  cardTitle: {
    fontFamily: 'Jua',
    fontSize: 19,
    lineHeight: 26,
    color: '#292929',
  },
  schedule: { gap: 12, flexGrow: 1 },
  scheduleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  scheduleTime: {
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: '#777574',
  },
  scheduleText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#292929',
    flexShrink: 1,
  },
  diary: { gap: 12, flexGrow: 1 },
  diaryText: { fontSize: 14, lineHeight: 24, color: '#494442' },
  diarySupporting: { fontSize: 13, lineHeight: 22, color: '#777574' },
  cardButton: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F3F1',
    borderRadius: 10,
  },
  cardButtonText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 22,
    color: '#494442',
    textAlign: 'center',
  },
  diaryButtonText: { color: '#B25447' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  notice: {
    fontSize: 14,
    lineHeight: 22,
    color: '#B25447',
    textAlign: 'center',
  },
});
