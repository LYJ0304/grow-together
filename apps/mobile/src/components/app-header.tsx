import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { useEntranceOnce } from '../theme/motion';
import { MotionPressable } from './motion-pressable';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { editorial } from '../theme/editorial';

export function AppHeader({
  disabled = false,
  polished = false,
  title,
  subtitle,
  onBack,
  backLabel = '이전 화면으로 돌아가기',
}: {
  disabled?: boolean;
  polished?: boolean;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <View testID="app-header" style={styles.header}>
      <View style={[styles.navigation, !onBack && styles.toolsOnly]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onBack}
            style={({ pressed }) => [
              styles.back,
              pressed && { backgroundColor: colors.border },
            ]}
          >
            <Image
              source={require('../../assets/images/main/chevron-left.svg')}
              tintColor={disabled ? colors.muted : colors.text}
              style={styles.backIcon}
              accessible={false}
            />
          </Pressable>
        ) : null}
        <HeaderTools disabled={disabled} polished={polished} />
      </View>
      {title ? (
        <Greeting title={title} subtitle={subtitle} polished={polished} />
      ) : null}
    </View>
  );
}
export function HeaderTools({
  disabled = false,
  polished = false,
}: {
  disabled?: boolean;
  polished?: boolean;
}) {
  return (
    <View style={styles.tools}>
      <HeaderButton
        polished={polished}
        accessibilityRole="button"
        accessibilityLabel="내 프로필 열기"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => router.push('/mypage')}
      >
        <Image
          source={require('../../assets/images/main/user.svg')}
          style={styles.icon}
          tintColor={disabled ? colors.muted : colors.brand}
          accessible={false}
        />
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
  const style = [
    styles.button,
    props.disabled && {
      backgroundColor: colors.disabled,
      borderColor: colors.disabled,
    },
  ];
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
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolsOnly: { justifyContent: 'flex-end' },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 24, height: 24 },
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    minHeight: 60,
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  tools: { flexDirection: 'row', gap: 8, alignSelf: 'flex-end' },
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 22, height: 22 },
  label: { ...typography.label, color: colors.primary, flexShrink: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: 4 },
  title: { ...editorial.title, flexShrink: 1 },
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
