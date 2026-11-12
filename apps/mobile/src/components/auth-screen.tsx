import { typography } from './typography';
import { colors } from '../theme/colors';
import { env } from '../config/env';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { useAuth } from './auth-provider';
import {
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

type AuthScreenProps = { mode: 'login' | 'signup' };

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const { client, notice: sessionNotice } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const canSkipAuthentication = env.canPreview;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const submit = async () => {
    if (pending.current) return;
    if (isSignup && !name.trim()) {
      setNotice('이름을 입력해 주세요.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    if (password.length < 8) {
      setNotice('비밀번호를 8자 이상 입력해 주세요.');
      return;
    }
    if (isSignup && password !== passwordConfirmation) {
      setNotice('비밀번호가 일치하지 않아요.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (isSignup) {
        await client.signup({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        router.replace({ pathname: '/login', params: { registered: 'true' } });
      } else {
        await client.login({ email: email.trim(), password });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로 돌아가기"
          disabled={busy}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/welcome')
          }
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../../assets/images/grow-together-logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessible={false}
          />
          <Text accessibilityRole="header" style={styles.title}>
            {isSignup ? '함께 키워가요' : '다시 만났네요!'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? '계정을 만들고 소중한 하루를 기록해요.'
              : '로그인하고 사랑둥이의 오늘을 만나보세요.'}
          </Text>

          {isSignup ? (
            <AuthField
              label="이름"
              placeholder="이름을 입력해 주세요"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              returnKeyType="next"
            />
          ) : null}
          <AuthField
            label="이메일"
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <AuthField
            label="비밀번호"
            placeholder="8자 이상 입력해 주세요"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            returnKeyType={isSignup ? 'next' : 'done'}
            onSubmitEditing={isSignup ? undefined : () => void submit()}
            accessory={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? '비밀번호 숨기기' : '비밀번호 보기'
                }
                onPress={() => setShowPassword((visible) => !visible)}
                hitSlop={8}
              >
                <Text style={styles.passwordToggle}>
                  {showPassword ? '숨기기' : '보기'}
                </Text>
              </Pressable>
            }
          />
          {isSignup ? (
            <AuthField
              label="비밀번호 확인"
              placeholder="비밀번호를 다시 입력해 주세요"
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          ) : null}

          {notice || sessionNotice || (!isSignup && registered === 'true') ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {notice ||
                sessionNotice ||
                '가입이 완료되었어요. 로그인해 주세요.'}
            </Text>
          ) : null}

          {!isSignup && canSkipAuthentication ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="인증 없이 UI 미리보기 메인 화면으로 이동합니다"
              disabled={busy}
              onPress={() => {
                void client
                  .preview()
                  .catch((error: Error) => setNotice(error.message));
              }}
              style={({ pressed }) => [
                styles.previewButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.previewLabel}>인증 없이 미리보기 진입</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            accessibilityState={{ busy, disabled: busy }}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>
              {busy ? '처리 중…' : isSignup ? '가입하기' : '로그인'}
            </Text>
          </Pressable>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignup ? '이미 계정이 있나요?' : '아직 계정이 없으신가요?'}
            </Text>
            <Pressable
              accessibilityRole="link"
              disabled={busy}
              onPress={() => router.replace(isSignup ? '/login' : '/signup')}
              hitSlop={8}
            >
              <Text style={styles.switchLink}>
                {isSignup ? '로그인' : '회원가입'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  accessory?: React.ReactNode;
} & Pick<
  React.ComponentProps<typeof TextInput>,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'keyboardType'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'secureTextEntry'
>;

function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  accessory,
  ...inputProps
}: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          selectionColor={colors.primary}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          {...inputProps}
        />
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  backButton: {
    width: 44,
    height: 44,
    marginTop: 7,
    marginLeft: 20,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { marginTop: -4, fontSize: 34, lineHeight: 38, color: colors.text },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 15,
    paddingBottom: 32,
  },
  logo: { width: 82, height: 82, alignSelf: 'center', marginBottom: 13 },
  title: {
    ...typography.title,
    fontSize: 28,
    lineHeight: 37,
    textAlign: 'center',
    color: colors.brand,
  },
  subtitle: {
    marginTop: 5,
    marginBottom: 29,
    ...typography.label,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.muted,
  },
  field: { marginBottom: 17 },
  fieldLabel: {
    marginBottom: 8,
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  inputRow: {
    minHeight: 55,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 15,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    outlineColor: colors.primary,
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    ...typography.label,
    fontSize: 16,
    color: colors.text,
  },
  passwordToggle: {
    paddingVertical: 10,
    ...typography.caption,
    fontSize: 12,
    color: colors.primary,
  },
  primaryButton: {
    minHeight: 58,
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { ...typography.section, fontSize: 19, color: colors.onBrand },
  previewButton: {
    minHeight: 54,
    marginTop: 9,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 15,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: { ...typography.button, fontSize: 16, color: colors.onTint },
  notice: {
    marginTop: 1,
    marginBottom: 5,
    ...typography.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  switchRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  switchText: { ...typography.caption, fontSize: 13, color: colors.muted },
  switchLink: { ...typography.caption, fontSize: 13, color: colors.primary },
  pressed: { backgroundColor: colors.tint },
});
