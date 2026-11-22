import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MotionPressable } from './motion-pressable';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { colors } from '../theme/colors';

// The screen owns Safe Area. This row contains navigation, never page content.
export function AppHeader({
  disabled = false,
  title,
  onBack,
  backLabel = '이전 화면으로 돌아가기',
  rightActions,
  style,
}: {
  disabled?: boolean;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  rightActions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View testID="app-header" style={[styles.header, style]}>
      <View style={styles.identity}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onBack}
            style={({ pressed }) => [styles.target, pressed && styles.pressed]}
          >
            <Image
              source={require('../../assets/images/main/chevron-left.svg')}
              tintColor={disabled ? colors.muted : colors.text}
              style={styles.backIcon}
              accessible={false}
            />
          </Pressable>
        ) : (
          <Image
            source={require('../../assets/images/brand/emblem.svg')}
            style={styles.logo}
            contentFit="contain"
            accessible={false}
          />
        )}
        {!onBack || title ? (
          <Text
            accessibilityRole={onBack ? 'header' : undefined}
            style={[styles.title, onBack && styles.detailTitle]}
          >
            {title ?? '같이 키우기'}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {rightActions}
        {!onBack ? <HeaderTools disabled={disabled} /> : null}
      </View>
    </View>
  );
}
export function HeaderTools({ disabled = false }: { disabled?: boolean }) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel="내 프로필 열기"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.push('/mypage')}
      style={styles.target}
    >
      <View style={[styles.avatar, disabled && styles.disabled]}>
        <Image
          source={require('../../assets/images/main/user.svg')}
          style={styles.icon}
          tintColor={disabled ? colors.muted : colors.brand}
          accessible={false}
        />
      </View>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.background,
    flexShrink: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: { width: 32, height: 32 },
  title: { ...typography.button, color: colors.heading, flexShrink: 1 },
  detailTitle: { ...typography.section, fontSize: 18, lineHeight: 26 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  target: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 20, height: 20 },
  backIcon: { width: 24, height: 24 },
  pressed: { backgroundColor: colors.border },
  disabled: { backgroundColor: colors.disabled },
});
