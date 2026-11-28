import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { useEntranceOnce } from '../theme/motion';
import { typography } from '../theme/typography';
import { parseDiaryDate } from '../lib/diary-date';

export function HomeDayHeader({ date }: { date: string }) {
  const heading = useEntranceOnce();
  const day = parseDiaryDate(date)!;
  return (
    <View style={styles.header}>
      <Animated.View testID="home-day-heading" style={heading}>
        <Text accessibilityRole="header" style={styles.date}>
          {day.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  date: { ...typography.section, color: colors.heading },
});
