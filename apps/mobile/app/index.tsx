import { colors } from '../src/theme/colors';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import LaunchLogo from '../src/components/launch-logo';
import {
  useLaunchIntro,
  useLaunchTransition,
} from '../src/components/launch-transition';

export default function HomeScreen() {
  const { finished: introFinished, finish: finishIntro } = useLaunchIntro();
  const [logoStarted, setLogoStarted] = useState(false);
  const [logoDrawn, setLogoDrawn] = useState(false);
  const startLogo = useCallback(() => setLogoStarted(true), []);
  const finishLogo = useCallback(
    (drawn = false) => {
      setLogoDrawn(drawn);
      finishIntro();
    },
    [finishIntro],
  );
  const motion = useLaunchTransition(
    '/',
    '/app-name',
    Platform.OS === 'web'
      ? introFinished
        ? logoDrawn
          ? 400
          : 120
        : null
      : 1000,
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={[styles.nextScreen, motion.fadeStyle]}
          testID={
            introFinished
              ? 'launch-intro-done'
              : logoStarted
                ? 'launch-intro-playing'
                : 'launch-intro-pending'
          }
        >
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <LaunchLogo
                played={introFinished}
                onComplete={finishLogo}
                onStart={startLogo}
              />
            </View>
            <Text
              ref={motion.titleRef}
              onLayout={motion.onTitleLayout}
              accessibilityRole="header"
              testID="launch-title"
              style={[styles.title, motion.titleHidden && { opacity: 0 }]}
            >
              같이 키우기
            </Text>
          </View>
          <View style={styles.footer}>
            <Text accessibilityLabel="Version 1.0" style={styles.version}>
              Version<Text style={styles.versionNumber}> 1.0</Text>
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="앱 이름 화면으로 이동"
            disabled={motion.busy}
            onPress={() => motion.navigate('/app-name')}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 21,
  },
  nextScreen: {
    flex: 1,
  },
  logoSection: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    gap: 26,
  },
  logo: {
    width: 224,
    height: 166.4,
  },
  footer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Jua',
    fontSize: 35,
    lineHeight: 44,
    letterSpacing: -0.7,
    color: colors.brand,
    textAlign: 'center',
  },
  version: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.28,
    color: colors.muted,
  },
  versionNumber: {
    fontSize: 14,
  },
});
