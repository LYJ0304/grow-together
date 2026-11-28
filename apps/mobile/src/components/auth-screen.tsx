import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentRef, type RefObject } from 'react';
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
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from './auth-provider';
import { AppHeader } from './app-header';
import { ActionButton } from './action-button';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { ApiError } from '../lib/api/errors';
import {
  authFieldOrder,
  validateAuthForm,
  type AuthFieldName,
  type AuthFormValues,
  type AuthFormErrors,
} from '../lib/features/auth/form-validation';

type AuthScreenProps = { mode: 'login' | 'signup' };
export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === 'signup';
  const { client, notice: sessionNotice } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const pending = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Partial<Record<AuthFieldName, number>>>({});
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmationRef = useRef<ComponentRef<typeof TextInput>>(null);
  const refs = {
    name: nameRef,
    email: emailRef,
    password: passwordRef,
    passwordConfirmation: confirmationRef,
  };
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<AuthFormValues>({
    name: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  });
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notice, setNotice] = useState('');
  const focusField = (field: AuthFieldName) => {
    requestAnimationFrame(() => {
      scroll.current?.scrollTo({
        y: Math.max(0, (positions.current[field] ?? 0) - spacing.lg),
        animated: false,
      });
      refs[field].current?.focus();
    });
  };
  const change = (field: AuthFieldName, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setNotice('');
    const validation = validateAuthForm(mode, next);
    setErrors((current) => {
      const updated = { ...current };
      for (const key of authFieldOrder)
        if (current[key]) updated[key] = validation[key];
      return updated;
    });
  };
  const blur = (field: AuthFieldName) => {
    const error = validateAuthForm(mode, values)[field];
    // Keep server field errors until editing; clearing on blur moves actions
    // between pointer-down and pointer-up and can cancel navigation presses.
    if (values[field] && error)
      setErrors((current) => ({ ...current, [field]: error }));
  };
  const submit = async () => {
    if (pending.current) return;
    const validation = validateAuthForm(mode, values);
    setErrors(validation);
    const first = authFieldOrder.find((field) => validation[field]);
    if (first) {
      focusField(first);
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (isSignup) {
        await client.signup({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });
        router.replace({ pathname: '/login', params: { registered: 'true' } });
      } else
        await client.login({
          email: values.email.trim(),
          password: values.password,
        });
    } catch (error) {
      if (
        isSignup &&
        error instanceof ApiError &&
        error.code === 'EMAIL_ALREADY_EXISTS'
      ) {
        setErrors({ email: error.message });
        focusField('email');
      } else
        setNotice(
          error instanceof Error ? error.message : '다시 시도해 주세요.',
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = (
    key: AuthFieldName,
    label: string,
    placeholder: string,
    extra: Partial<
      Omit<React.ComponentProps<typeof TextInput>, 'onLayout'>
    > = {},
    accessory?: React.ReactNode,
  ) => (
    <AuthField
      key={key}
      inputRef={refs[key]}
      label={label}
      fieldId={key}
      placeholder={placeholder}
      value={values[key]}
      onChangeText={(value) => change(key, value)}
      error={errors[key]}
      editable={!busy}
      onBlur={() => blur(key)}
      onLayout={(y) => {
        positions.current[key] = y;
      }}
      accessory={accessory}
      {...extra}
    />
  );
  const toggle = (confirmation: boolean) => {
    const visible = confirmation ? showConfirmation : showPassword;
    const label = confirmation ? '비밀번호 확인' : '비밀번호';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${visible ? '숨기기' : '보기'}`}
        disabled={busy}
        onPress={() => {
          if (confirmation) setShowConfirmation(!visible);
          else setShowPassword(!visible);
          requestAnimationFrame(() =>
            (confirmation ? confirmationRef : passwordRef).current?.focus(),
          );
        }}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={styles.toggleLabel}>{visible ? '숨기기' : '보기'}</Text>
      </Pressable>
    );
  };
  const information =
    sessionNotice ||
    (!isSignup && registered === 'true'
      ? '가입이 완료되었어요. 로그인해 주세요.'
      : '');
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <AppHeader
          disabled={busy}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace('/welcome')
          }
          style={styles.header}
        />
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text accessibilityRole="header" style={styles.title}>
            {isSignup ? '계정 만들기' : '로그인'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? '아이와 함께한 하루를 기록해요.'
              : '아이와 함께한 기록을 이어가요.'}
          </Text>
          {isSignup
            ? field('name', '이름', '이름을 입력해 주세요', {
                autoComplete: 'name',
                returnKeyType: 'next',
                onSubmitEditing: () => emailRef.current?.focus(),
                submitBehavior: 'submit',
              })
            : null}
          {field('email', '이메일', 'example@email.com', {
            keyboardType: 'email-address',
            autoCapitalize: 'none',
            autoComplete: 'email',
            returnKeyType: 'next',
            onSubmitEditing: () => passwordRef.current?.focus(),
            submitBehavior: 'submit',
          })}
          {field(
            'password',
            '비밀번호',
            '8~72자로 입력해 주세요',
            {
              autoCapitalize: 'none',
              secureTextEntry: !showPassword,
              autoComplete: isSignup ? 'new-password' : 'current-password',
              returnKeyType: isSignup ? 'next' : 'done',
              submitBehavior: isSignup ? 'submit' : 'blurAndSubmit',
              onSubmitEditing: () =>
                isSignup ? confirmationRef.current?.focus() : void submit(),
            },
            toggle(false),
          )}
          {isSignup
            ? field(
                'passwordConfirmation',
                '비밀번호 확인',
                '비밀번호를 다시 입력해 주세요',
                {
                  autoCapitalize: 'none',
                  secureTextEntry: !showConfirmation,
                  autoComplete: 'new-password',
                  returnKeyType: 'done',
                  onSubmitEditing: () => void submit(),
                },
                toggle(true),
              )
            : null}
          {notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.errorNotice}
            >
              {notice}
            </Text>
          ) : information ? (
            <Text accessibilityLiveRegion="polite" style={styles.information}>
              {information}
            </Text>
          ) : null}
          <View style={styles.submit} accessibilityState={{ busy }}>
            <ActionButton
              variant="primary"
              disabled={busy}
              label={busy ? '처리 중…' : isSignup ? '가입하기' : '로그인'}
              onPress={() => void submit()}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignup ? '이미 계정이 있나요?' : '아직 계정이 없으신가요?'}
            </Text>
            <Pressable
              accessibilityRole="link"
              disabled={busy}
              onPress={() => router.replace(isSignup ? '/login' : '/signup')}
              style={({ pressed }) => [
                styles.switchTarget,
                pressed && styles.pressed,
              ]}
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

type AuthFieldProps = Omit<
  React.ComponentProps<typeof TextInput>,
  'onLayout'
> & {
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>;
  label: string;
  fieldId: AuthFieldName;
  error?: string;
  accessory?: React.ReactNode;
  onLayout: (y: number) => void;
};
function AuthField({
  inputRef,
  label,
  fieldId,
  error,
  accessory,
  onLayout,
  ...inputProps
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={styles.field}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.focused,
          error && styles.invalid,
        ]}
      >
        <TextInput
          {...inputProps}
          ref={inputRef}
          autoCorrect={false}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
          style={styles.input}
        />
        {accessory}
      </View>
      {error ? (
        <Text
          nativeID={`${fieldId}-error`}
          accessibilityLiveRegion="polite"
          style={styles.fieldError}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { maxWidth: 420, paddingHorizontal: spacing.lg + spacing.sm },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg + spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.section,
  },
  title: {
    ...typography.section,
    fontSize: 26,
    lineHeight: 34,
    color: colors.heading,
  },
  subtitle: {
    ...typography.label,
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.section,
  },
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.caption, color: colors.text, marginBottom: 6 },
  inputRow: {
    minHeight: 54,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  input: {
    ...typography.body,
    lineHeight: 24,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md,
    paddingRight: spacing.sm,
    color: colors.heading,
    outlineColor: colors.primary,
  },
  toggle: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  toggleLabel: { ...typography.caption, color: colors.primary },
  pressed: { backgroundColor: colors.tint },
  fieldError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  errorNotice: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  information: {
    ...typography.caption,
    color: colors.onTint,
    backgroundColor: colors.tint,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  submit: { marginTop: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: spacing.xs,
    marginVertical: spacing.sm,
  },
  switchText: { ...typography.caption, color: colors.muted },
  switchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  switchLink: { ...typography.caption, color: colors.primary },
});
