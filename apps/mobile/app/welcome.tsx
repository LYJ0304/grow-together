import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const [notice, setNotice] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topSpace} />
        <Image
          source={require('../assets/images/grow-together-logo.png')}
          style={styles.logo}
          contentFit="contain"
          accessible={false}
        />
        <View style={styles.headingSpace} />
        <Text accessibilityRole="header" style={styles.heading}>
          {'같이 키우기\n시작해볼까요?'}
        </Text>
        <View style={styles.buttonSpace} />
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="로그인 기능은 준비 중입니다"
            onPress={() => setNotice('로그인 기능은 준비 중입니다.')}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, styles.primaryLabel]}>
              로그인
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="회원가입 기능은 준비 중입니다"
            onPress={() => setNotice('회원가입 기능은 준비 중입니다.')}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonLabel, styles.secondaryLabel]}>
              가입하기
            </Text>
          </Pressable>
        </View>
        {notice ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.notice}
          >
            {notice}
          </Text>
        ) : null}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: { flexGrow: 1, paddingHorizontal: 26, alignItems: 'center' },
  topSpace: { flexGrow: 147, flexBasis: 0, minHeight: 24 },
  headingSpace: { flexGrow: 62, flexBasis: 0, minHeight: 32 },
  buttonSpace: { flexGrow: 65, flexBasis: 0, minHeight: 32 },
  bottomSpace: { flexGrow: 131, flexBasis: 0, minHeight: 24 },
  logo: { width: 178, height: 178 },
  heading: {
    fontFamily: 'Jua',
    fontSize: 35,
    lineHeight: 56,
    color: '#D26A5C',
    textAlign: 'center',
  },
  buttons: { width: '100%', gap: 24 },
  button: {
    minHeight: 66,
    paddingHorizontal: 15,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#D26A5C',
    boxShadow: '0px 4px 2px rgba(160, 163, 177, 0.3)',
  },
  secondaryButton: { backgroundColor: '#FDEDE6' },
  pressed: { opacity: 0.8 },
  buttonLabel: {
    fontFamily: 'Jua',
    fontSize: 20,
    lineHeight: 32,
    textAlign: 'center',
  },
  primaryLabel: { color: '#FFFFFF' },
  secondaryLabel: { color: '#D26A5C' },
  notice: {
    marginTop: 16,
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#D26A5C',
    textAlign: 'center',
  },
});
