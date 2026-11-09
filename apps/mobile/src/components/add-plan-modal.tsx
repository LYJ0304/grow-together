import { useRef, useState } from 'react';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { useReduceMotion } from '../theme/motion';
import { successFeedback } from '../lib/haptics';
import { useChatKeyboard } from '../lib/use-chat-keyboard';
import { ApiError } from '../lib/api/errors';
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type PlanInput = { title: string; time: string; description: string };

export function AddPlanModal({
  date,
  onClose,
  onAdd,
  initialValues,
}: {
  date: Date;
  onClose: () => void;
  onAdd: (plan: PlanInput) => void | Promise<void>;
  initialValues?: PlanInput;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [time, setTime] = useState(initialValues?.time ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useChatKeyboard();
  const titleInput = useRef<TextInput>(null);
  const dirty =
    title !== (initialValues?.title ?? '') ||
    time !== (initialValues?.time ?? '') ||
    description !== (initialValues?.description ?? '');
  const requestClose = () => {
    if (submitting.current) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    if (!title.trim()) {
      setError('계획명을 입력해 주세요.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) {
      setError('시간을 09:30처럼 입력해 주세요. (00:00~23:59)');
      return;
    }
    if (title.trim().length > 80 || description.trim().length > 255) {
      setError('계획명은 80자, 메모는 255자 이내로 입력해 주세요.');
      return;
    }
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await onAdd({
        title: title.trim(),
        time: time.trim(),
        description: description.trim(),
      });
      successFeedback();
    } catch (error) {
      setError(
        error instanceof ApiError && (error.status === 0 || error.status >= 500)
          ? '저장 여부를 확인하지 못했어요. 창을 닫고 목록 새로고침으로 결과를 확인한 뒤 다시 시도해 주세요.'
          : error instanceof Error
            ? error.message
            : '저장하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <Modal
      transparent
      animationType={
        reduced ? 'none' : Platform.OS === 'web' ? 'fade' : 'slide'
      }
      onShow={() => titleInput.current?.focus()}
      onRequestClose={requestClose}
    >
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.overlay,
          keyboard.viewport && {
            flex: 0,
            height: keyboard.viewport.height,
            transform: [{ translateY: keyboard.viewport.offsetTop }],
          },
        ]}
      >
        <Pressable
          accessibilityLabel="일정 입력 창 닫기"
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          disabled={pending}
          onPress={requestClose}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: keyboard.visible ? 0 : insets.bottom },
            ]}
            accessibilityViewIsModal
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
              contentContainerStyle={styles.content}
            >
              <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.heading}>
                  {initialValues ? '계획 수정' : '계획 추가'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    initialValues ? '계획 수정 닫기' : '계획 추가 닫기'
                  }
                  hitSlop={8}
                  disabled={pending}
                  onPress={requestClose}
                  style={styles.close}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.date}>
                {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}
                일
              </Text>
              <Text style={styles.label}>계획명</Text>
              <TextInput
                selectionColor={colors.primary}
                ref={titleInput}
                accessibilityLabel="계획명"
                placeholder="예: 아이와 공원 산책"
                placeholderTextColor={colors.muted}
                value={title}
                editable={!pending}
                onChangeText={setTitle}
                maxLength={80}
                style={styles.input}
              />
              <Text style={styles.label}>시간</Text>
              <TextInput
                selectionColor={colors.primary}
                accessibilityLabel="계획 시간"
                placeholder="09:30"
                placeholderTextColor={colors.muted}
                value={time}
                editable={!pending}
                onChangeText={setTime}
                maxLength={5}
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.hint}>
                24시간 형식으로 입력해 주세요. 예: 14:30
              </Text>
              <Text style={styles.label}>메모 (선택)</Text>
              <TextInput
                selectionColor={colors.primary}
                accessibilityLabel="계획 메모"
                placeholder="기억하고 싶은 내용을 적어 주세요"
                placeholderTextColor={colors.muted}
                value={description}
                editable={!pending}
                onChangeText={setDescription}
                multiline
                maxLength={255}
                textAlignVertical="top"
                style={[styles.input, styles.memo]}
              />
            </ScrollView>
            <View style={styles.footer}>
              {confirmClose ? (
                <View accessibilityRole="alert" style={styles.confirm}>
                  <Text style={styles.label}>작성 중인 내용을 버릴까요?</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setConfirmClose(false);
                      titleInput.current?.focus();
                    }}
                    style={styles.button}
                  >
                    <Text style={styles.cancelText}>계속 작성</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!submitting.current) onClose();
                    }}
                    style={styles.button}
                  >
                    <Text style={styles.cancelText}>내용 버리기</Text>
                  </Pressable>
                </View>
              ) : null}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {error}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending}
                  onPress={requestClose}
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancel,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending}
                  accessibilityState={{ disabled: pending, busy: pending }}
                  onPress={() => void submit()}
                  style={({ pressed }) => [
                    styles.button,
                    styles.submit,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.submitText}>
                    {pending
                      ? '저장 중…'
                      : initialValues
                        ? '수정하기'
                        : '추가하기'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  keyboard: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  sheet: {
    maxHeight: '100%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderBottomLeftRadius: Platform.OS === 'web' ? radius.sheet : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? radius.sheet : 0,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  content: { padding: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    ...typography.section,
    fontSize: 22,
    lineHeight: 32,
    color: colors.text,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 28, color: colors.muted },
  date: { ...typography.label, color: colors.primary, marginBottom: 8 },
  label: {
    ...typography.label,
    color: colors.text,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    outlineColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.field,
  },
  memo: { minHeight: 100 },
  hint: { marginTop: 8, ...typography.caption, color: colors.muted },
  error: { marginTop: 16, ...typography.caption, color: colors.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: colors.tint },
  submit: { backgroundColor: colors.primary },
  cancelText: { ...typography.button, color: colors.muted },
  submitText: { ...typography.button, color: colors.surface },
  pressed: { opacity: 0.75 },
  confirm: {
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingBottom: 12,
  },
});
