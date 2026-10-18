import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);
  const stacked = !hydrated || width < 360 || fontScale > 1.2;
  const scroll = useRef<ScrollView>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (notice) scroll.current?.scrollToEnd({ animated: true });
  }, [notice]);

  // shortcut: Figma sample data for UI QA; replace when the API-backed home screen is requested.
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
          <RoutineProgress />
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
              {[
                ['07:00', '기상'],
                ['09:30', '산책 ☀️'],
                ['12:00', '점심'],
                ['15:00', '낮잠'],
              ].map(([time, activity]) => (
                <View key={time} style={styles.scheduleRow}>
                  <Text
                    style={[
                      styles.scheduleTime,
                      time === '09:30' && styles.accent,
                    ]}
                  >
                    {time}
                  </Text>
                  <Text style={styles.scheduleText}>{activity}</Text>
                </View>
              ))}
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
  accent: { color: '#B25447' },
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
