import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AppNameScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nextScreen}>
          <View style={styles.titleSection}>
            <Text accessibilityRole="header" style={styles.title}>
              같이 키우기
            </Text>
          </View>
          <Text accessibilityLabel="Version 1.0" style={styles.version}>
            Version<Text style={styles.versionNumber}> 1.0</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="로그인 및 가입 선택 화면으로 이동"
            onPress={() => router.push('/welcome')}
            style={StyleSheet.absoluteFill}
          />
        </View>
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
