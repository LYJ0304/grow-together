import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Errors = { name?: string; birthday?: string };

export default function ChildrenScreen() {
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmed, setConfirmed] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const birthdayInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  // shortcut: this is a preview until the child profile storage flow is decided.
  useFocusEffect(
    useCallback(() => {
      setName('');
      setBirthday('');
      setErrors({});
      setConfirmed(false);
    }, []),
  );

  const confirm = () => {
    const nextErrors: Errors = {};
    if (!name.trim()) nextErrors.name = '아이 이름을 입력해주세요.';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    if (match) {
      date.setFullYear(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
    }
    if (
      !match ||
      Number(match[1]) < 1 ||
      date.getFullYear() !== Number(match[1]) ||
      date.getMonth() + 1 !== Number(match[2]) ||
      date.getDate() !== Number(match[3])
    ) {
      nextErrors.birthday =
        '생년월일을 올바른 YYYY-MM-DD 형식으로 입력해주세요.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date > today)
        nextErrors.birthday = '생년월일은 오늘 또는 이전 날짜로 입력해주세요.';
    }
    setErrors(nextErrors);
    if (nextErrors.name) nameInput.current?.focus();
    else if (nextErrors.birthday) birthdayInput.current?.focus();
    else {
      setName(name.trim());
      setBirthday(birthday.trim());
      setConfirmed(true);
      Keyboard.dismiss();
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android'
              ? 'height'
              : undefined
        }
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마이페이지로 돌아가기"
            onPress={() => router.dismissTo('/mypage')}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={styles.backLabel}>‹ 마이페이지</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {confirmed ? '아이 정보를 확인해주세요' : '아이를 소개해주세요'}
          </Text>
          <Text style={styles.subtitle}>
            {confirmed
              ? '입력한 이름과 생년월일을 확인해보세요.'
              : '이름과 생일로 아이의 이야기를 시작해요.'}
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              미리보기 화면이에요. 입력한 정보는 저장되지 않으며, 화면을
              나가거나 새로고침하면 초기화돼요.
            </Text>
          </View>
          <View style={styles.card}>
            {confirmed ? (
              <>
                <Text style={styles.label}>아이 이름</Text>
                <Text style={styles.value}>{name}</Text>
                <Text style={styles.label}>생년월일</Text>
                <Text style={styles.value}>{birthday}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmed(false)}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.buttonLabel}>다시 수정</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>아이 이름 (필수)</Text>
                <TextInput
                  ref={nameInput}
                  accessibilityLabel="아이 이름"
                  accessibilityHint={errors.name}
                  aria-describedby={
                    errors.name ? 'child-name-error' : undefined
                  }
                  aria-invalid={Boolean(errors.name)}
                  placeholder="예: 하늘"
                  placeholderTextColor="#88889D"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  maxLength={50}
                  returnKeyType="next"
                  onSubmitEditing={() => birthdayInput.current?.focus()}
                  style={[styles.input, errors.name && styles.invalid]}
                />
                {errors.name ? (
                  <Text
                    nativeID="child-name-error"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={styles.error}
                  >
                    {errors.name}
                  </Text>
                ) : null}
                <Text style={styles.label}>생년월일 (필수)</Text>
                <TextInput
                  ref={birthdayInput}
                  accessibilityLabel="생년월일"
                  accessibilityHint={
                    errors.birthday ??
                    'YYYY-MM-DD 형식으로 입력해주세요. 예: 2024-03-15'
                  }
                  aria-describedby={
                    errors.birthday
                      ? 'child-birthday-error child-birthday-hint'
                      : 'child-birthday-hint'
                  }
                  aria-invalid={Boolean(errors.birthday)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#88889D"
                  value={birthday}
                  onChangeText={(value) => {
                    setBirthday(value);
                    setErrors((current) => ({
                      ...current,
                      birthday: undefined,
                    }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={confirm}
                  style={[styles.input, errors.birthday && styles.invalid]}
                />
                <Text nativeID="child-birthday-hint" style={styles.hint}>
                  예: 2024-03-15 · 오늘까지의 날짜를 입력해주세요.
                </Text>
                {errors.birthday ? (
                  <Text
                    nativeID="child-birthday-error"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={styles.error}
                  >
                    {errors.birthday}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={confirm}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.buttonLabel}>입력 내용 확인</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  keyboard: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backLabel: { fontFamily: 'Jua', fontSize: 16, color: '#4F4F4F' },
  title: { fontFamily: 'Jua', fontSize: 26, lineHeight: 34, color: '#4F4F4F' },
  subtitle: {
    marginTop: 8,
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 21,
    color: '#858895',
  },
  notice: {
    marginVertical: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FDEDE6',
  },
  noticeText: {
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 20,
    color: '#87463D',
  },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 12px rgba(84, 87, 92, 0.08)',
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#4F4F4F',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E5E5E8',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#4F4F4F',
    backgroundColor: '#FAF9F9',
  },
  invalid: { borderColor: '#B44638' },
  hint: {
    marginTop: 8,
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 18,
    color: '#858895',
  },
  error: {
    marginTop: 8,
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 20,
    color: '#B44638',
  },
  value: {
    marginBottom: 16,
    fontFamily: 'Jua',
    fontSize: 20,
    lineHeight: 28,
    color: '#4F4F4F',
  },
  button: {
    minHeight: 48,
    marginTop: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D26A5C',
  },
  buttonLabel: { fontFamily: 'Jua', fontSize: 16, color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});
