import { useCallback, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PageIntro } from '../../src/components/page-intro';
import { AppHeader } from '../../src/components/app-header';
import { MotionPressable } from '../../src/components/motion-pressable';
import { ReportContent } from '../../src/components/report/report-content';
import { useAuth } from '../../src/components/auth-provider';
import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { useSessionValue } from '../../src/lib/session-state';
import {
  currentReportWeek,
  shiftReportDate,
} from '../../src/lib/features/report/week';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function ReportScreen() {
  const { status, client } = useAuth();
  const scroll = useRef<ScrollView>(null);
  useTabScrollToTop(scroll);
  const [current, setCurrent] = useState(() => currentReportWeek());
  const [selected, setSelected] = useSessionValue('reportWeek', current);
  useFocusEffect(
    useCallback(() => {
      const update = () => setCurrent(currentReportWeek());
      update();
      const timer = setInterval(update, 60000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') update();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, []),
  );
  const week = selected > current ? current : selected;
  const end = shiftReportDate(week, 6);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${date}T12:00:00Z`));
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <StatusBar style="dark" />
      <AppHeader section="리포트" />
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <PageIntro
          eyebrow="OUR WEEKLY STORY"
          title="한 주의 이야기"
          description="함께한 활동과 남긴 기록을 돌아보는 공간이에요."
        />
        <View style={styles.week}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="이전 주"
            style={styles.arrow}
            onPress={() => setSelected(shiftReportDate(week, -7))}
          >
            <Text style={styles.arrowText}>‹</Text>
          </MotionPressable>
          <View style={styles.period}>
            <Text style={styles.caption}>
              {week.slice(0, 4) === end.slice(0, 4)
                ? `${week.slice(0, 4)}년`
                : `${week.slice(0, 4)}–${end.slice(0, 4)}년`}
            </Text>
            <Text accessibilityRole="header" style={styles.range}>
              {dateLabel(week)} – {dateLabel(end)}
            </Text>
          </View>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="다음 주"
            disabled={week >= current}
            accessibilityState={{ disabled: week >= current }}
            style={[styles.arrow, week >= current && styles.disabled]}
            onPress={() => setSelected(shiftReportDate(week, 7))}
          >
            <Text style={styles.arrowText}>›</Text>
          </MotionPressable>
        </View>
        {/* API issue 184 must supply a validated API adapter. Never treat unavailable data as empty records. */}
        <ReportContent
          resource={{
            state: status === 'authenticated' ? 'unavailable' : 'loginRequired',
          }}
          onSchedule={() => router.navigate('/todo')}
          onRecords={() => router.navigate('/calendar')}
          onLogin={() => void client.logout()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 24,
    paddingBottom: 36,
  },
  week: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  period: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  range: {
    ...typography.button,
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
  },
  caption: { ...typography.caption, color: colors.muted },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  arrowText: { ...typography.title, fontSize: 28, color: colors.primary },
  disabled: { opacity: 0.4 },
});
