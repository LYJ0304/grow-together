import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { ActionButton } from '../src/components/action-button';
import { useLaunchTransition } from '../src/components/launch-transition';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function WelcomeScreen() {
  const motion = useLaunchTransition('/welcome');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.animatedContent, motion.fadeStyle]}>
          <View style={styles.hero}>
            <Image
              source={require('../assets/images/grow-together-logo.png')}
              style={styles.logo}
              contentFit="contain"
              accessible={false}
            />
            <Text
              ref={motion.titleRef}
              onLayout={motion.onTitleLayout}
              accessibilityRole="header"
              style={[styles.brandName, motion.titleHidden && { opacity: 0 }]}
            >
              같이 키우기
            </Text>
            <Text style={styles.value}>
              아이와 함께한 하루,{'\n'}작은 순간까지 기록해요.
            </Text>
            <Text style={styles.description}>
              오늘의 활동을 계획하고,{'\n'}함께한 기억을 차곡차곡 남겨보세요.
            </Text>
          </View>
          <View style={styles.actions}>
            <ActionButton
              label="로그인"
              variant="primary"
              disabled={motion.busy}
              onPress={() => router.push('/login')}
            />
            <View style={styles.signupRow}>
              <Text style={styles.signupPrompt}>처음이신가요?</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="가입하기"
                accessibilityHint="회원가입 화면으로 이동합니다"
                accessibilityState={{ disabled: motion.busy }}
                disabled={motion.busy}
                onPress={() => router.push('/signup')}
                style={({ pressed }) => [
                  styles.signup,
                  pressed && styles.signupPressed,
                ]}
              >
                <Text
                  style={[
                    styles.signupLabel,
                    motion.busy && styles.disabledLabel,
                  ]}
                >
                  가입하기
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg + spacing.sm,
    paddingVertical: spacing.section,
    alignItems: 'center',
  },
  animatedContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 420,
    justifyContent: 'center',
    gap: spacing.section * 2,
  },
  hero: { alignItems: 'center' },
  logo: { width: 104, height: 104 },
  // Match the shared launch overlay; position measurement can change, type must not jump.
  brandName: {
    fontFamily: 'Jua',
    fontSize: 35,
    lineHeight: 44,
    letterSpacing: -0.7,
    color: colors.brand,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  value: {
    ...typography.section,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
    color: colors.heading,
    textAlign: 'center',
    marginTop: spacing.section,
  },
  description: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  actions: { width: '100%', gap: spacing.sm },
  signupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  signupPrompt: { ...typography.caption, color: colors.muted },
  signup: {
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  signupPressed: { backgroundColor: colors.tint },
  signupLabel: {
    ...typography.button,
    fontSize: 14,
    lineHeight: 22,
    color: colors.onTint,
  },
  disabledLabel: { color: colors.muted },
});
