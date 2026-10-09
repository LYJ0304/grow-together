import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNavigation } from '../src/components/bottom-navigation';

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (notice) scroll.current?.scrollToEnd({ animated: true });
  }, [notice]);

  // shortcut: Figma sample data for UI QA; replace when the API-backed home screen is requested.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(14, 68 - insets.top) },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>아이와 함께하는 오늘</Text>
          <Text accessibilityRole="header" style={styles.title}>
            사랑둥이와 함께한지 <Text style={styles.accent}>+378일</Text>
          </Text>
        </View>

        <View style={styles.routineCard}>
          <Image
            source={require('../assets/images/main/routine-card.svg')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
            accessible={false}
          />
          <View
            style={styles.progressArt}
            accessible
            accessibilityLabel="루틴 진행률 70퍼센트"
          >
            <Image
              source={require('../assets/images/main/progress-track.svg')}
              style={styles.progressTrack}
              accessible={false}
            />
            <Image
              source={require('../assets/images/main/progress-active.svg')}
              style={styles.progressActive}
              accessible={false}
            />
            <Image
              source={require('../assets/images/main/progress-disc.svg')}
              style={styles.progressDisc}
              accessible={false}
            />
            <Image
              source={require('../assets/images/main/character.png')}
              style={styles.character}
              contentFit="contain"
              accessible={false}
            />
          </View>
          <Text style={styles.progressLabel}>루틴 진행률 70%</Text>
          <View style={styles.tip}>
            <Image
              source={require('../assets/images/main/tip-card.svg')}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible={false}
            />
            <Text style={styles.tipText}>
              오늘은 햇살이 좋아요 ☀️ 15분 산책을 추천해요
            </Text>
          </View>
        </View>

        <View style={styles.cards}>
          <View style={styles.detailCard}>
            <Image
              source={require('../assets/images/main/detail-card.svg')}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible={false}
            />
            <Text accessibilityRole="header" style={styles.cardTitle}>
              오늘의 일정
            </Text>
            <View style={styles.schedule}>
              <Text style={styles.scheduleText}>07:00 기상</Text>
              <Text style={[styles.scheduleText, styles.accent]}>
                09:30 산책 ☀️
              </Text>
              <Text style={styles.scheduleText}>12:00 점심</Text>
              <Text style={styles.scheduleText}>15:00 낮잠</Text>
            </View>
            <View style={styles.cardSpacer} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice('일정 상세 화면은 준비 중입니다.')}
              style={({ pressed }) => [
                styles.cardButton,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={require('../assets/images/main/schedule-button.svg')}
                style={StyleSheet.absoluteFill}
                contentFit="fill"
                accessible={false}
              />
              <Text style={styles.cardButtonText}>전체 보기 →</Text>
            </Pressable>
          </View>
          <View style={styles.detailCard}>
            <Image
              source={require('../assets/images/main/detail-card.svg')}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              accessible={false}
            />
            <Text accessibilityRole="header" style={styles.cardTitle}>
              AI 일기
            </Text>
            <View style={styles.diary}>
              <Text style={styles.diaryText}>오늘은 낮잠을 1.5h 자며</Text>
              <Text style={styles.diaryText}>안정적인 하루를 보냈어요.</Text>
              <Text style={styles.diaryText}>저녁엔 짧은 독서 1권 추천📖</Text>
            </View>
            <View style={styles.cardSpacer} />
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice('AI 일기 만들기는 준비 중입니다.')}
              style={({ pressed }) => [
                styles.cardButton,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={require('../assets/images/main/diary-button.svg')}
                style={StyleSheet.absoluteFill}
                contentFit="fill"
                accessible={false}
              />
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
  content: { paddingHorizontal: 17, paddingBottom: 26 },
  header: { paddingHorizontal: 11, marginBottom: 21 },
  eyebrow: {
    fontFamily: 'Jua',
    fontSize: 18,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  title: {
    marginTop: 7,
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 26,
    color: '#4F4F4F',
  },
  accent: { color: '#D26A5C' },
  routineCard: { alignItems: 'center', paddingTop: 25, paddingBottom: 32 },
  progressArt: { width: 209, height: 178 },
  progressTrack: {
    position: 'absolute',
    left: 0,
    top: 16,
    width: 162,
    height: 162,
  },
  progressActive: {
    position: 'absolute',
    left: 76,
    top: 0,
    width: 132.646,
    height: 161.999,
  },
  progressDisc: {
    position: 'absolute',
    left: 23,
    top: 39,
    width: 116,
    height: 116,
  },
  character: {
    position: 'absolute',
    left: 13,
    top: -38,
    width: 137,
    height: 206,
  },
  progressLabel: {
    marginTop: 23,
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  tip: {
    alignSelf: 'stretch',
    minHeight: 39,
    marginTop: 16,
    marginHorizontal: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  tipText: {
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 19,
    color: '#4F4F4F',
    textAlign: 'center',
  },
  cards: { flexDirection: 'row', gap: 18, marginTop: 16 },
  detailCard: { flex: 1, minWidth: 0, minHeight: 242, padding: 16 },
  cardTitle: {
    fontFamily: 'Jua',
    fontSize: 20,
    lineHeight: 25,
    color: '#4F4F4F',
  },
  schedule: { marginTop: 10, gap: 4 },
  scheduleText: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 20,
    color: '#4F4F4F',
  },
  diary: { marginTop: 10, gap: 9 },
  diaryText: {
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 17,
    color: '#4F4F4F',
  },
  cardSpacer: { flex: 1, minHeight: 16 },
  cardButton: { minHeight: 36, justifyContent: 'center', alignItems: 'center' },
  cardButtonText: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 20,
    color: '#4F4F4F',
    textAlign: 'center',
  },
  diaryButtonText: { color: '#D96147' },
  pressed: { opacity: 0.8 },
  notice: {
    marginTop: 16,
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 22,
    color: '#D26A5C',
    textAlign: 'center',
  },
});
