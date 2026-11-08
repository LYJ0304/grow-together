import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { typography } from './typography';

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
        style={styles.button}
      >
        <Image
          source={require('../../assets/images/main/user.svg')}
          style={styles.icon}
          tintColor="#A84D40"
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
        style={styles.button}
      >
        <Image
          source={require('../../assets/images/chat/settings.svg')}
          style={styles.icon}
          tintColor="#A84D40"
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F9',
    flexShrink: 0,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 24, height: 24 },
  label: { ...typography.label, color: '#A84D40', flexShrink: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.section, color: '#A44F43' },
  subtitle: { ...typography.caption, color: '#625B57' },
});
