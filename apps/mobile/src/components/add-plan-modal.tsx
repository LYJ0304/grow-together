import { useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

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
      animationType="fade"
      onRequestClose={() => {
        if (!submitting.current) onClose();
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView
              keyboardShouldPersistTaps="handled"
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
                  onPress={onClose}
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
                accessibilityLabel="계획명"
                placeholder="예: 아이와 공원 산책"
                placeholderTextColor="#88889D"
                value={title}
                editable={!pending}
                onChangeText={setTitle}
                maxLength={80}
                style={styles.input}
              />
              <Text style={styles.label}>시간</Text>
              <TextInput
                accessibilityLabel="계획 시간"
                placeholder="09:30"
                placeholderTextColor="#88889D"
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
                accessibilityLabel="계획 메모"
                placeholder="기억하고 싶은 내용을 적어 주세요"
                placeholderTextColor="#88889D"
                value={description}
                editable={!pending}
                onChangeText={setDescription}
                multiline
                maxLength={255}
                textAlignVertical="top"
                style={[styles.input, styles.memo]}
              />
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
                  onPress={onClose}
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  keyboard: { flex: 1, justifyContent: 'center', padding: 20 },
  sheet: {
    maxHeight: '100%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  content: { padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontFamily: 'Jua', fontSize: 24, color: '#4F4F4F' },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 28, color: '#88889D' },
  date: { fontFamily: 'Jua', fontSize: 14, color: '#D26A5C', marginBottom: 8 },
  label: {
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#4F4F4F',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E8',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Jua',
    fontSize: 15,
    color: '#4F4F4F',
    backgroundColor: '#FAF9F9',
  },
  memo: { minHeight: 100 },
  hint: { marginTop: 8, fontFamily: 'Jua', fontSize: 12, color: '#88889D' },
  error: { marginTop: 16, fontFamily: 'Jua', fontSize: 13, color: '#D26A5C' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: '#F6F6F5' },
  submit: { backgroundColor: '#D26A5C' },
  cancelText: { fontFamily: 'Jua', fontSize: 16, color: '#88889D' },
  submitText: { fontFamily: 'Jua', fontSize: 16, color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
});
