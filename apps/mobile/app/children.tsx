import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/components/auth-provider';
import {
  saveChildProfile,
  validateChildProfile,
  type ChildProfileErrors,
} from '../src/lib/child-profile';
import { useChildProfile } from '../src/lib/use-child-profile';

export default function ChildrenScreen() {
  const { accountKey, epoch } = useAuth();
  return <ChildrenEditor key={`${epoch}:${accountKey}`} />;
}

function ChildrenEditor() {
  const profile = useChildProfile();
  const { client, epoch } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [errors, setErrors] = useState<ChildProfileErrors>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [leaveAction, setLeaveAction] = useState<(() => void) | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const pending = useRef(false);
  const nameInput = useRef<TextInput>(null);
  const birthdayInput = useRef<TextInput>(null);
  const navigation = useNavigation();
  const dirty =
    editing &&
    (name !== (profile.data?.name ?? '') ||
      birthday !== (profile.data?.birthday ?? ''));
  const current = () =>
    client.getSnapshot().epoch === epoch &&
    client.getSnapshot().accountKey === profile.accountKey;
  usePreventRemove(dirty || saving, ({ data }) => {
    if (!pending.current)
      setLeaveAction(() => () => navigation.dispatch(data.action));
  });
  useEffect(() => {
    if (discarding && !dirty && !saving) leaveAction?.();
  }, [discarding, dirty, saving, leaveAction]);
  useEffect(() => {
    if (Platform.OS !== 'web' || (!dirty && !saving)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  const edit = () => {
    setName(profile.data?.name ?? '');
    setBirthday(profile.data?.birthday ?? '');
    setErrors({});
    setNotice('');
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setErrors({});
    setNotice('');
  };
  const save = async () => {
    if (pending.current || !profile.accountKey || !profile.isSuccess) return;
    const nextErrors = validateChildProfile({ name, birthday });
    setErrors(nextErrors);
    if (nextErrors.name) {
      nameInput.current?.focus();
      return;
    }
    if (nextErrors.birthday) {
      birthdayInput.current?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    setNotice('');
    try {
      const value = await saveChildProfile(profile.accountKey, {
        name,
        birthday,
      });
      if (!current()) return;
      queryClient.setQueryData(profile.queryKey, value);
      setEditing(false);
      setNotice('아이 정보를 저장했어요.');
      Keyboard.dismiss();
    } catch (error) {
      if (current())
        setNotice(
          error instanceof Error
            ? error.message
            : '저장하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (current()) setSaving(false);
    }
  };
  const error = !profile.accountKey
    ? '계정을 확인하지 못했어요. 다시 로그인해 주세요.'
    : profile.error?.message;
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마이페이지로 돌아가기"
            disabled={saving}
            onPress={() => router.dismissTo('/mypage')}
            style={styles.back}
          >
            <Text style={styles.backLabel}>‹ 마이페이지</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            {editing
              ? profile.data
                ? '아이 정보 수정'
                : '아이 추가'
              : '아이 프로필'}
          </Text>
          <Text style={styles.subtitle}>
            이름과 생일로 아이의 이야기를 시작해요.
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              이 기기에 저장되는 아이 정보예요. 다른 기기와는 동기화되지 않아요.
            </Text>
          </View>
          {error ? (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              {profile.accountKey && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void profile.refetch()}
                  style={styles.button}
                >
                  <Text style={styles.buttonLabel}>다시 시도</Text>
                </Pressable>
              )}
            </View>
          ) : profile.isPending ? (
            <Text accessibilityRole="alert">
              아이 정보를 불러오는 중이에요.
            </Text>
          ) : (
            <View style={styles.card}>
              {!editing ? (
                <>
                  {profile.data ? (
                    <>
                      <Text style={styles.label}>아이 이름</Text>
                      <Text style={styles.value}>{profile.data.name}</Text>
                      <Text style={styles.label}>생년월일</Text>
                      <Text style={styles.value}>{profile.data.birthday}</Text>
                    </>
                  ) : (
                    <Text style={styles.value}>등록된 아이가 없어요.</Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={edit}
                    style={styles.button}
                  >
                    <Text style={styles.buttonLabel}>
                      {profile.data ? '수정' : '아이 추가'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View pointerEvents={saving ? 'none' : 'auto'}>
                  <Text style={styles.label}>아이 이름 (필수)</Text>
                  <TextInput
                    ref={nameInput}
                    editable={!saving}
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
                    editable={!saving}
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
                    onSubmitEditing={() => void save()}
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
                    onPress={() => void save()}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.button,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.buttonLabel}>
                      {saving ? '저장 중...' : '저장'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={cancel}
                    disabled={saving}
                    style={styles.back}
                  >
                    <Text style={styles.backLabel}>취소</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          {notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.noticeText}
            >
              {notice}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        transparent
        visible={leaveAction !== null && !discarding}
        onRequestClose={() => setLeaveAction(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#00000055',
          }}
        >
          <View accessibilityRole="alert" style={styles.card}>
            <Text style={styles.value}>저장하지 않은 변경사항이 있어요.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLeaveAction(null)}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>계속 작성</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(false);
                setDiscarding(true);
              }}
              style={styles.back}
            >
              <Text style={styles.backLabel}>변경사항 버리고 나가기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
