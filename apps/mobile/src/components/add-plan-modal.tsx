import { useState } from 'react';
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
}: {
  date: Date;
  onClose: () => void;
  onAdd: (plan: PlanInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!title.trim()) {
      setError('계획명을 입력해 주세요.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) {
      setError('시간을 09:30처럼 입력해 주세요. (00:00~23:59)');
      return;
    }
    onAdd({
      title: title.trim(),
      time: time.trim(),
      description: description.trim(),
    });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
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
                  계획 추가
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="계획 추가 닫기"
                  hitSlop={8}
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
                onChangeText={setDescription}
                multiline
                maxLength={500}
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
                  onPress={submit}
                  style={({ pressed }) => [
                    styles.button,
                    styles.submit,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.submitText}>추가하기</Text>
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
