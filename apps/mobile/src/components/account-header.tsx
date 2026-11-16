import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
export function AccountHeader({
  title,
  onBack,
  disabled = false,
}: {
  title: string;
  onBack(): void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 화면으로"
        disabled={disabled}
        onPress={onBack}
        style={styles.back}
      >
        <Text style={[styles.link, disabled && { color: colors.muted }]}>
          ‹ 뒤로
        </Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  back: { minHeight: 44, minWidth: 60, justifyContent: 'center' },
  link: { ...typography.button, color: colors.primary },
  title: { ...typography.section, color: colors.heading, flex: 1 },
});
