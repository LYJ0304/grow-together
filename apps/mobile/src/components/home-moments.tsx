import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from './motion-pressable';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export function HomeMoments({
  diaryText,
  activitiesText,
  onDiaryPress,
  onActivitiesPress,
}: {
  diaryText: string;
  activitiesText: string;
  onDiaryPress: () => void;
  onActivitiesPress: () => void;
}) {
  return (
    <View style={styles.moments}>
      <Text accessibilityRole="header" style={styles.title}>
        하루의 순간
      </Text>
      <Text style={styles.meta}>작은 순간을 기록으로 남겨보세요.</Text>
      <View style={styles.momentGroup}>
        <MomentRow
          title="일기와 사진"
          value={diaryText}
          icon={require('../../assets/images/diary-book.svg')}
          onPress={onDiaryPress}
        />
        <MomentRow
          title="완료한 활동"
          value={activitiesText}
          icon={require('../../assets/images/main/todo.svg')}
          onPress={onActivitiesPress}
        />
        <MomentRow
          title="육아 리포트"
          value="주간 기록 보기"
          icon={require('../../assets/images/main/report.svg')}
          onPress={() => router.navigate('/report')}
          last
        />
      </View>
    </View>
  );
}

function MomentRow({
  title,
  value,
  icon,
  onPress,
  last = false,
}: {
  title: string;
  value: string;
  icon: import('expo-image').ImageSource;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      onPress={onPress}
      style={[styles.momentRow, !last && styles.momentDivider]}
    >
      <Image
        source={icon}
        tintColor={colors.text}
        style={styles.momentIcon}
        accessible={false}
      />
      <Text style={styles.momentTitle}>{title}</Text>
      <Text style={styles.meta}>{value}</Text>
      <Text accessible={false} style={styles.chevron}>
        ›
      </Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  moments: { gap: 8 },
  momentGroup: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
  },
  momentRow: {
    minHeight: 60,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  momentDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  momentIcon: { width: 22, height: 22 },
  momentTitle: {
    ...typography.label,
    color: colors.text,
    flex: 1,
    minWidth: 88,
  },
  chevron: { fontSize: 24, color: colors.muted },
  title: { ...typography.section, color: colors.heading },
  meta: { ...typography.caption, color: colors.muted, flexShrink: 1 },
});
