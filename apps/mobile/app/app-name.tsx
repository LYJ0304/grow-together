import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLaunchTransition } from '../src/components/launch-transition';

export default function AppNameScreen() {
  const motion = useLaunchTransition('/app-name');
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View style={[styles.nextScreen, motion.fadeStyle]}>
          <View style={styles.titleSection}>
            <Text
              ref={motion.titleRef}
              onLayout={motion.onTitleLayout}
              accessibilityRole="header"
              style={[styles.title, motion.titleHidden && { opacity: 0 }]}
            >
              같이 키우기
            </Text>
          </View>
          <Text accessibilityLabel="Version 1.0" style={styles.version}>
            Version<Text style={styles.versionNumber}> 1.0</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="로그인 및 가입 선택 화면으로 이동"
            disabled={motion.busy}
            onPress={() => motion.navigate('/welcome')}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 21 },
  nextScreen: { flex: 1, alignItems: 'center' },
  titleSection: {
    flex: 1,
    minHeight: 180,
    justifyContent: 'center',
    paddingBottom: 32,
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
  versionNumber: { fontSize: 14 },
});
