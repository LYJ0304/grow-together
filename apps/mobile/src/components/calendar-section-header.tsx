import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/components/typography';

type SectionAction = {
  label: string;
  accessibilityLabel?: string;
  onPress(): void;
};

export function CalendarSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: SectionAction;
}) {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.label}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.sm,
  },
  title: { ...typography.section, color: colors.heading },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
  },
  label: { ...typography.label, color: colors.primary },
  pressed: { backgroundColor: colors.tint },
});
