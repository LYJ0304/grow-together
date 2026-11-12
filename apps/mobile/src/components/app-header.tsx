import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { useEntranceOnce } from '../theme/motion';
import { MotionPressable } from './motion-pressable';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { typography } from './typography';
import { colors } from '../theme/colors';

export function AppHeader({
  disabled = false,
  polished = false,
  title,
  subtitle,
}: {
  disabled?: boolean;
  polished?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <View testID="app-header" style={styles.header}>
      <HeaderButton
        polished={polished}
        accessibilityRole="button"
        accessibilityLabel="아이 프로필 열기"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => router.push('/children')}
      >
        <Image
          source={require('../../assets/images/main/user.svg')}
          style={styles.icon}
          tintColor={colors.brand}
          accessible={false}
        />
        {!title ? <Text style={styles.label}>아이 프로필</Text> : null}
      </HeaderButton>
      {title ? (
        <Greeting title={title} subtitle={subtitle} polished={polished} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <HeaderButton
        polished={polished}
        accessibilityRole="button"
        accessibilityLabel="앱 설정"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => router.push('/mypage')}
      >
        <Image
          source={require('../../assets/images/chat/settings.svg')}
          style={styles.icon}
          tintColor={colors.brand}
          accessible={false}
        />
        {!title ? <Text style={styles.label}>설정</Text> : null}
      </HeaderButton>
    </View>
  );
}
function Greeting({
  title,
  subtitle,
  polished,
}: {
  title: string;
  subtitle?: string;
  polished: boolean;
}) {
  const entrance = useEntranceOnce(polished);
  return (
    <Animated.View style={[styles.copy, entrance]}>
      <View style={styles.greetingLine}>
        <Text
          accessibilityRole="header"
          style={[styles.title, polished && styles.warmTitle]}
        >
          {title}
        </Text>
        {polished ? (
          <View accessible={false} style={styles.brandPoint} />
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Animated.View>
  );
}
function HeaderButton({
  polished,
  children,
  ...props
}: {
  polished: boolean;
  children: ReactNode;
} & import('react-native').PressableProps) {
  const style = [styles.button, props.disabled && { opacity: 0.55 }];
  return polished ? (
    <MotionPressable {...props} style={style}>
      {children}
    </MotionPressable>
  ) : (
    <Pressable
      {...props}
      style={({ pressed }) => [
        style,
        pressed && { backgroundColor: colors.background },
      ]}
    >
      {children}
    </Pressable>
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
  title: { ...typography.section, color: colors.text, flexShrink: 1 },
  greetingLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warmTitle: { fontSize: 22, lineHeight: 30, fontWeight: '600' },
  brandPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  subtitle: { ...typography.caption, color: colors.muted },
});
