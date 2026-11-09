import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { typography } from './typography';
import { colors } from '../theme/colors';

export function AppHeader({
  disabled = false,
  title,
  subtitle,
}: {
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <View testID="app-header" style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="아이 프로필 열기"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => router.push('/children')}
        style={({ pressed }) => [
          styles.button,
          disabled && { opacity: 0.55 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Image
          source={require('../../assets/images/main/user.svg')}
          style={styles.icon}
          tintColor={colors.primary}
          accessible={false}
        />
        {!title ? <Text style={styles.label}>아이 프로필</Text> : null}
      </Pressable>
      {title ? (
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="앱 설정"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => router.push('/mypage')}
        style={({ pressed }) => [
          styles.button,
          disabled && { opacity: 0.55 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Image
          source={require('../../assets/images/chat/settings.svg')}
          style={styles.icon}
          tintColor={colors.primary}
          accessible={false}
        />
        {!title ? <Text style={styles.label}>설정</Text> : null}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  button: {
    minWidth: 48,
    minHeight: 48,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 22, height: 22 },
  label: { ...typography.label, color: colors.primary, flexShrink: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 4 },
  title: { ...typography.section, color: colors.text },
  subtitle: { ...typography.caption, color: colors.muted },
});
