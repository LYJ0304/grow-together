import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { AccountHeader } from '../src/components/account-header';
import { ActionButton } from '../src/components/action-button';
import { useAuth } from '../src/components/auth-provider';
import { useUserProfile } from '../src/lib/use-user-profile';
import {
  createUserApi,
  normalizeProfileName,
} from '../src/lib/features/user/userApi';
import type { UserProfile } from '../src/lib/features/user/types';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

export default function ProfileScreen() {
  const profile = useUserProfile();
  const { epoch } = useAuth();
  if (profile.data)
    return (
      <ProfileForm
        key={`${epoch}:${profile.data.id}`}
        profile={profile.data}
        queryKey={profile.queryKey}
      />
    );
  return (
    <SafeAreaView style={styles.screen}>
      <AccountHeader
        title="내 프로필 수정"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/mypage')
        }
      />
      <View style={styles.content}>
        <Text
          accessibilityRole={profile.isError ? 'alert' : undefined}
          style={styles.body}
        >
          {profile.isError ? '내 정보를 불러오지 못했어요.' : '내 정보 확인 중'}
        </Text>
        {profile.isError ? (
          <ActionButton
            label="내 정보 다시 불러오기"
            variant="secondary"
            onPress={() => void profile.refetch()}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
function ProfileForm({
  profile,
  queryKey,
}: {
  profile: UserProfile;
  queryKey: readonly unknown[];
}) {
  const { client, epoch } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [initialName] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  const [notice, setNotice] = useState('');
  const [leave, setLeave] = useState<NavigationAction | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [saved, setSaved] = useState(false);
  const normalized = normalizeProfileName(name);
  const dirty = normalized !== normalizeProfileName(initialName);
  const invalid = !normalized || normalized.length > 50;
  const input = useRef<TextInput>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  usePreventRemove(busy || (dirty && !allowed), ({ data }) => {
    if (!pending.current) setLeave(data.action);
  });
  useEffect(() => {
    if (allowed && leave) navigation.dispatch(leave);
  }, [allowed, leave, navigation]);
  useEffect(() => {
    if (saved && !busy) router.dismissTo('/mypage');
  }, [saved, busy]);
  useEffect(() => {
    if (!dirty || Platform.OS !== 'web') return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/mypage');
  const save = async () => {
    if (pending.current || invalid || !dirty) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const next = await createUserApi(client).updateName(normalized);
      if (!active.current || client.getSnapshot().epoch !== epoch) return;
      queryClient.setQueryData(queryKey, next);
      setAllowed(true);
      setSaved(true);
    } catch (error) {
      if (active.current && client.getSnapshot().epoch === epoch)
        setNotice(
          error instanceof Error
            ? error.message
            : '저장하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (active.current && client.getSnapshot().epoch === epoch)
        setBusy(false);
    }
  };
  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AccountHeader title="내 프로필 수정" disabled={busy} onBack={back} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>이름</Text>
          <TextInput
            ref={input}
            accessibilityLabel="이름"
            accessibilityHint="최대 50자까지 입력할 수 있어요."
            editable={!busy}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            selectionColor={colors.primary}
            style={styles.input}
          />
          {invalid ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {!normalized
                ? '이름을 입력해주세요.'
                : '이름은 50자 이내로 입력해주세요.'}
            </Text>
          ) : null}
          <Text style={styles.label}>이메일</Text>
          <Text
            selectable
            accessibilityLabel={`이메일 ${profile.email}`}
            style={styles.body}
          >
            {profile.email}
          </Text>
          <Text style={styles.caption}>
            이메일은 여기에서 변경할 수 없어요.
          </Text>
          {notice ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {notice}
            </Text>
          ) : null}
          <ActionButton
            label={busy ? '저장 중…' : '변경사항 저장'}
            variant="primary"
            disabled={busy || invalid || !dirty}
            onPress={() => void save()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      {leave ? (
        <Modal
          transparent
          animationType="none"
          onRequestClose={() => {
            setLeave(null);
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <SafeAreaView style={styles.overlay}>
            <ScrollView
              style={styles.panel}
              contentContainerStyle={styles.dialog}
              keyboardShouldPersistTaps="handled"
            >
              <View
                role="dialog"
                aria-modal
                accessibilityViewIsModal
                accessibilityLabel="변경사항 확인"
                style={{ gap: 16 }}
              >
                <Text accessibilityRole="header" style={styles.label}>
                  변경사항을 버릴까요?
                </Text>
                <Text style={styles.body}>
                  저장하지 않은 이름은 반영되지 않아요.
                </Text>
                <ActionButton
                  label="계속 수정"
                  variant="tertiary"
                  onPress={() => {
                    setLeave(null);
                    requestAnimationFrame(() => input.current?.focus());
                  }}
                />
                <ActionButton
                  label="변경사항 버리기"
                  variant="primary"
                  onPress={() => setAllowed(true)}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  body: { ...typography.body, color: colors.text },
  label: { ...typography.section, color: colors.heading },
  caption: { ...typography.caption, color: colors.muted },
  error: { ...typography.body, color: colors.danger },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 12,
    padding: 14,
    minHeight: 52,
    outlineColor: colors.primary,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.overlay,
  },
  panel: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  dialog: { padding: 20, borderRadius: 16, backgroundColor: colors.surface },
});
