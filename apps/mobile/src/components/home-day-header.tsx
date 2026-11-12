import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useEntranceOnce } from '../theme/motion';
import { typography } from '../theme/typography';
import { MotionPressable } from './motion-pressable';
import { diaryDateKey } from '../lib/diary-storage';

export function HomeDayHeader({
  date,
  today,
  blocked,
  onChangeDate,
}: {
  date: string;
  today: string;
  blocked: boolean;
  onChangeDate: (date: string) => void;
}) {
  const heading = useEntranceOnce();
  const day = new Date(`${date}T12:00:00`);
  const change = (offset: number) => {
    const next = new Date(day);
    next.setDate(next.getDate() + offset);
    const key = diaryDateKey(next);
    onChangeDate(key);
  };
  return (
    <View testID="app-header" style={styles.header}>
      <View style={styles.tools}>
        <View style={styles.toolGroup}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="아이 프로필 열기"
            onPress={() => router.push('/children')}
            style={styles.tool}
          >
            <Image
              source={require('../../assets/images/main/user.svg')}
              tintColor={colors.brand}
              style={styles.icon}
              accessible={false}
            />
          </MotionPressable>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="앱 설정"
            onPress={() => router.push('/mypage')}
            style={styles.tool}
          >
            <Image
              source={require('../../assets/images/chat/settings.svg')}
              tintColor={colors.brand}
              style={styles.icon}
              accessible={false}
            />
          </MotionPressable>
        </View>
      </View>
      <View style={styles.dayRow}>
        <Animated.View testID="home-day-heading" style={[styles.copy, heading]}>
          <Text accessibilityRole="header" style={styles.title}>
            {date === today
              ? '오늘'
              : day.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                })}
          </Text>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="날짜 기록 보기"
            onPress={() =>
              router.navigate({ pathname: '/calendar', params: { date } })
            }
            style={styles.dateButton}
          >
            <Text style={styles.date}>
              {day.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </Text>
          </MotionPressable>
        </Animated.View>
        <View style={styles.arrows}>
          {([-1, 1] as const).map((offset) => {
            const disabled = blocked || (offset === 1 && date >= today);
            return (
              <MotionPressable
                key={offset}
                accessibilityRole="button"
                accessibilityLabel={offset < 0 ? '이전 날' : '다음 날'}
                disabled={disabled}
                accessibilityState={{ disabled }}
                onPress={() => change(offset)}
                style={[styles.arrow, disabled && styles.disabled]}
              >
                <Text accessible={false} style={styles.arrowText}>
                  {offset < 0 ? '‹' : '›'}
                </Text>
              </MotionPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { gap: 14 },
  tools: { flexDirection: 'row', justifyContent: 'flex-end' },
  toolGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  tool: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 22, height: 22 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    ...typography.section,
    fontSize: 32,
    lineHeight: 40,
    color: colors.heading,
  },
  dateButton: { minHeight: 44, justifyContent: 'center' },
  date: { ...typography.caption, color: colors.muted },
  arrows: { flexDirection: 'row', gap: 8 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 28, lineHeight: 32, color: colors.text },
  disabled: { opacity: 0.4 },
});
