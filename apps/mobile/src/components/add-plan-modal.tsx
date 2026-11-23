import DateTimePicker from '@react-native-community/datetimepicker';
import { ActionButton } from './action-button';
import { useRef, useState } from 'react';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { useReduceMotion } from '../theme/motion';
import { selectionFeedback, successFeedback } from '../lib/haptics';
import { useChatKeyboard } from '../lib/use-chat-keyboard';
import { ApiError } from '../lib/api/errors';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView, safeAreaLength } from '@/components/safe-area-view';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTime(value: Date) {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function pickerTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes);
}

type PlanInput = {
  title: string;
  time: string;
  description: string;
  durationMinutes?: number;
};

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
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const initialDuration =
    initialValues?.durationMinutes?.toString() ?? (initialValues ? '' : '30');
  const [duration, setDuration] = useState(initialDuration);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const reduced = useReduceMotion();
  const insets = useSafeAreaInsets();
  const keyboard = useChatKeyboard();
  const dirty =
    duration !== initialDuration ||
    title !== (initialValues?.title ?? '') ||
    time !== (initialValues?.time ?? '') ||
    description !== (initialValues?.description ?? '');
  const requestClose = () => {
    if (submitting.current) return;
    Keyboard.dismiss();
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
    if (!timePattern.test(time.trim())) {
      setError(
        Platform.OS === 'ios'
          ? '시작 시간을 선택해 주세요.'
          : '시간을 09:30처럼 입력해 주세요. (00:00~23:59)',
      );
      return;
    }
    if (title.trim().length > 80 || description.trim().length > 255) {
      setError('계획명은 80자, 메모는 255자 이내로 입력해 주세요.');
      return;
    }
    const minutes = duration.trim() ? Number(duration) : undefined;
    if (
      minutes !== undefined &&
      (!/^\d+$/.test(duration) ||
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 1440 ||
        Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes > 1440)
    ) {
      setError('소요 시간은 1~1440분이며 같은 날짜 안에 끝나야 해요.');
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
        durationMinutes: minutes,
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
              {
                paddingBottom: keyboard.visible
                  ? 0
                  : safeAreaLength('bottom', insets.bottom),
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                disabled={pending}
                onPress={requestClose}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.cancelText, pending && styles.disabledText]}
                >
                  취소
                </Text>
              </Pressable>
              <Text accessibilityRole="header" style={styles.heading}>
                {initialValues ? '계획 수정' : '계획 추가'}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={pending || confirmClose}
                accessibilityState={{
                  disabled: pending || confirmClose,
                  busy: pending,
                }}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.submitText,
                    (pending || confirmClose) && styles.disabledText,
                  ]}
                >
                  {pending
                    ? '저장 중…'
                    : initialValues
                      ? '수정하기'
                      : '추가하기'}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.form}
              contentContainerStyle={styles.content}
            >
              {confirmClose ? (
                <View accessibilityRole="alert" style={styles.field}>
                  <Text style={styles.label}>작성 중인 내용을 버릴까요?</Text>
                  <ActionButton
                    label="계속 작성"
                    variant="tertiary"
                    onPress={() => setConfirmClose(false)}
                  />
                  <ActionButton
                    label="내용 버리기"
                    variant="destructive-confirm"
                    onPress={() => {
                      if (!submitting.current) onClose();
                    }}
                  />
                </View>
              ) : (
                <>
                  <Text style={styles.date}>
                    {date.getFullYear()}년 {date.getMonth() + 1}월{' '}
                    {date.getDate()}일
                  </Text>
                  {error ? (
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      style={styles.error}
                    >
                      {error}
                    </Text>
                  ) : null}
                  <View style={styles.field}>
                    <Text style={styles.label}>계획명</Text>
                    <TextInput
                      selectionColor={colors.primary}
                      accessibilityLabel="계획명"
                      placeholder="예: 아이와 공원 산책"
                      placeholderTextColor={colors.muted}
                      value={title}
                      editable={!pending}
                      onChangeText={setTitle}
                      maxLength={80}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.timing}>
                    <View style={styles.timingField}>
                      <Text style={styles.label}>시작 시간</Text>
                      {Platform.OS === 'ios' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="계획 시간"
                          accessibilityValue={{ text: time || '선택 안 됨' }}
                          accessibilityState={{
                            expanded: timePickerOpen,
                            disabled: pending,
                          }}
                          disabled={pending}
                          onPress={() => {
                            Keyboard.dismiss();
                            if (!timePattern.test(time))
                              setTime(formatTime(new Date()));
                            setTimePickerOpen(!timePickerOpen);
                          }}
                          style={({ pressed }) => [
                            styles.input,
                            styles.timeButton,
                            timePickerOpen && styles.timeSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.inputText,
                              !time && styles.disabledText,
                            ]}
                          >
                            {time || '시간 선택'}
                          </Text>
                        </Pressable>
                      ) : (
                        <TextInput
                          selectionColor={colors.primary}
                          accessibilityLabel="계획 시간"
                          placeholder="예: 09:30"
                          placeholderTextColor={colors.muted}
                          value={time}
                          editable={!pending}
                          onChangeText={setTime}
                          maxLength={5}
                          autoCapitalize="none"
                          style={styles.input}
                        />
                      )}
                    </View>
                    <View style={styles.timingField}>
                      <Text style={styles.label}>소요 시간 (분)</Text>
                      <TextInput
                        placeholderTextColor={colors.muted}
                        accessibilityLabel="계획 소요 시간"
                        accessibilityHint="AI 추천을 받으려면 소요 시간을 입력하세요."
                        value={duration}
                        onChangeText={setDuration}
                        editable={!pending}
                        keyboardType="number-pad"
                        maxLength={4}
                        style={styles.input}
                      />
                    </View>
                  </View>
                  {Platform.OS === 'ios' &&
                  timePickerOpen &&
                  timePattern.test(time) ? (
                    <DateTimePicker
                      accessibilityLabel="시작 시간 선택"
                      disabled={pending}
                      mode="time"
                      display="spinner"
                      locale="ko-KR"
                      themeVariant="light"
                      style={styles.timePicker}
                      value={pickerTime(time)}
                      onValueChange={(_, next) => {
                        if (submitting.current) return;
                        const value = formatTime(next);
                        if (value === time) return;
                        setTime(value);
                        selectionFeedback();
                      }}
                    />
                  ) : null}
                  <View style={styles.field}>
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
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay },
  keyboard: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  sheet: {
    maxHeight: '94%',
    flexShrink: 1,
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
  form: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  heading: {
    ...typography.section,
    flex: 1,
    textAlign: 'center',
    color: colors.heading,
  },
  headerAction: {
    minWidth: 76,
    maxWidth: '30%',
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  cancelText: { ...typography.label, color: colors.text, textAlign: 'center' },
  submitText: {
    ...typography.label,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  date: { ...typography.label, color: colors.muted },
  label: { ...typography.label, color: colors.text, fontWeight: '600' },
  field: { gap: spacing.sm },
  timing: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  timingField: { flex: 1, minWidth: 116, gap: spacing.sm },
  inputText: { ...typography.body, color: colors.text },
  input: {
    ...typography.body,
    minHeight: 50,
    outlineColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.field,
  },
  timeButton: { justifyContent: 'center' },
  timeSelected: { borderColor: colors.primary, backgroundColor: colors.tint },
  timePicker: { height: 216, width: '100%' },
  memo: { minHeight: 88, paddingTop: spacing.md },
  error: { ...typography.caption, color: colors.danger },
  disabledText: { color: colors.muted },
  pressed: { backgroundColor: colors.background },
});
