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
  const intro = useLaunchIntro();
  const [logoStarted, setLogoStarted] = useState(false);
  const startLogo = useCallback(() => setLogoStarted(true), []);
  const motion = useLaunchTransition(
    '/',
    '/app-name',
    Platform.OS === 'web' ? (intro.finished ? 120 : null) : 1000,
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={[styles.nextScreen, motion.fadeStyle]}
          testID={
            intro.finished
              ? 'launch-intro-done'
              : logoStarted
                ? 'launch-intro-playing'
                : 'launch-intro-pending'
          }
        >
          <View style={styles.logoSection}>
            <View style={styles.logo}>
              <LaunchLogo
                played={intro.finished}
                onComplete={intro.finish}
                onStart={startLogo}
              />
            </View>
          </View>
          <View style={styles.footer}>
            <Text
              ref={motion.titleRef}
              onLayout={motion.onTitleLayout}
              accessibilityRole="header"
              testID="launch-title"
              style={[styles.title, motion.titleHidden && { opacity: 0 }]}
            >
              같이 키우기
            </Text>
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
    backgroundColor: '#FAF9F9',
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
    minHeight: 253,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 84,
    paddingBottom: 24,
  },
  logo: {
    width: 145,
    height: 145,
    transform: [{ translateX: -2 }],
  },
  footer: {
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'Jua',
    fontSize: 35,
    lineHeight: 44,
    letterSpacing: -0.7,
    color: '#D26A5C',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.08)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  version: {
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.28,
    color: '#C2C3CB',
  },
  versionNumber: {
    fontSize: 14,
  },
});
