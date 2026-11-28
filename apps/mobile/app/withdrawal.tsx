import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '../src/components/safe-area-view';
import { AccountHeader } from '../src/components/account-header';
import { ActionButton } from '../src/components/action-button';
import { useAuth } from '../src/components/auth-provider';
import { ApiError } from '../src/lib/api/errors';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';

export default function WithdrawalScreen() {
  const { client, epoch, status } = useAuth();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        setPassword('');
        setConfirm(false);
      },
      [],
    ),
  );
  usePreventRemove(busy && status === 'authenticated', () => {});
  useEffect(() => {
    if (Platform.OS !== 'web' || !busy) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [busy]);
  const submit = async () => {
    if (pending.current || !password || !understood || uncertain) return;
    pending.current = true;
    setBusy(true);
    setConfirm(false);
    setNotice('');
    const secret = password;
    setPassword('');
    try {
      await client.withdraw(secret);
    } catch (error) {
      if (!alive.current || client.getSnapshot().epoch !== epoch) return;
      const known =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      setUncertain(!known);
      setNotice(
        known
          ? error.message
          : '탈퇴 결과를 확인하지 못했어요. 다시 로그인해 계정 상태를 확인해주세요.',
      );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <AccountHeader
        title="회원 탈퇴"
        disabled={busy}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/mypage')
        }
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android'
              ? 'height'
              : undefined
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityRole="header" style={styles.heading}>
            계정을 삭제하시겠어요?
          </Text>
          <View style={styles.notice}>
            <Text style={styles.body}>
              탈퇴하면 내 프로필과 아이 정보, 일정, 일기가 삭제되고 모든
              기기에서 로그아웃돼요. 삭제한 계정과 기록은 복구할 수 없어요.
            </Text>
            <Text style={styles.body}>
              사진은 순차적으로 정리되며 시간이 걸릴 수 있어요. 백업과 외부
              서비스의 보관 정책은 별도로 적용돼요.
            </Text>
          </View>
          <Text style={styles.label}>현재 비밀번호</Text>
          <TextInput
            accessibilityLabel="현재 비밀번호"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy && !uncertain}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            maxLength={72}
            placeholder="현재 비밀번호를 입력해주세요"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="삭제 및 복구 불가 안내 확인"
            accessibilityState={{
              checked: understood,
              disabled: busy || uncertain,
            }}
            aria-checked={understood}
            disabled={busy || uncertain}
            onPress={() => setUnderstood(!understood)}
            style={styles.checkbox}
          >
            <Text accessible={false} style={styles.label}>
              {understood ? '✓' : '□'}
            </Text>
            <Text style={styles.body}>
              삭제되는 정보와 복구할 수 없다는 안내를 확인했어요.
            </Text>
          </Pressable>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.body}>
              {notice}
            </Text>
          ) : null}
          {uncertain ? (
            <ActionButton
              label="다시 로그인해 확인하기"
              variant="secondary"
              onPress={() => void client.logout()}
            />
          ) : (
            <ActionButton
              variant="primary"
              label={busy ? '탈퇴 처리 중' : '회원 탈퇴'}
              disabled={busy || !password || !understood}
              onPress={() => setConfirm(true)}
            />
          )}
          <ActionButton
            label="취소"
            variant="tertiary"
            disabled={busy}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/mypage')
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={confirm}
        transparent
        animationType="none"
        onRequestClose={() => setConfirm(false)}
      >
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.heading}>
              정말 탈퇴하시겠어요?
            </Text>
            <Text style={styles.body}>계정과 기록을 복구할 수 없어요.</Text>
            <ActionButton
              variant="primary"
              label="탈퇴 확정"
              disabled={busy}
              onPress={() => void submit()}
            />
            <ActionButton
              label="계속 이용하기"
              variant="tertiary"
              onPress={() => setConfirm(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heading: { ...typography.section, color: colors.heading },
  label: { ...typography.label, color: colors.heading },
  body: { ...typography.body, color: colors.text, flexShrink: 1 },
  notice: {
    backgroundColor: colors.tint,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.field,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  checkbox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
