import type { ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

// A single accessible status represents the group; its shapes are decorative.
export function SkeletonGroup({
  label,
  testID,
  children,
}: {
  label: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      aria-busy={true}
      accessibilityLiveRegion="polite"
      testID={testID}
      style={styles.group}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>
    </View>
  );
}

export function Skeleton({
  width = '100%',
  height = 14,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  return <View accessible={false} style={[styles.block, { width, height }]} />;
}

export function ScheduleSkeleton({
  label = '일정을 불러오고 있어요.',
}: {
  label?: string;
}) {
  return (
    <SkeletonGroup label={label} testID="schedule-skeleton">
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={24} height={24} />
          <View style={styles.copy}>
            <Skeleton width={index === 1 ? '55%' : '72%'} height={16} />
            <Skeleton width={56} height={12} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  group: { flexShrink: 1 },
  block: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    marginVertical: spacing.xs,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, minWidth: 0 },
});
