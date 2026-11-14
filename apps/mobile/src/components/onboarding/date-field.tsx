import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { typography } from '../typography';
import { dateLabel } from '../../lib/onboarding';
import {
  clampSelection,
  initialSelection,
  partMaximum,
  selectionValue,
  type DatePart,
} from '../../lib/date-selection';
import { ActionButton } from '../action-button';
export type DateFieldHandle = { focus(): void };
export type DateFieldProps = {
  label: string;
  value: string;
  onChange(value: string): void;
  maximum?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
};
export const DateField = forwardRef<DateFieldHandle, DateFieldProps>(
  function DateField(
    { label, value, onChange, maximum, disabled, error, required },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const trigger = useRef<View>(null);
    const valueId = useId();
    const begin = () => {
      if (disabled) return;
      Keyboard.dismiss();
      setOpen(true);
    };
    useImperativeHandle(ref, () => ({ focus: () => trigger.current?.focus() }));
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {required ? ' (필수)' : ''}
        </Text>
        <Pressable
          ref={trigger}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: dateLabel(value) }}
          aria-describedby={valueId}
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          accessibilityHint={error ?? '날짜 선택 창을 엽니다.'}
          accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
          disabled={disabled}
          onPress={begin}
          style={({ pressed }) => [
            styles.trigger,
            pressed && styles.pressed,
            error && styles.invalid,
            disabled && styles.disabled,
          ]}
        >
          <Text
            nativeID={valueId}
            style={[styles.value, disabled && styles.disabledText]}
          >
            {dateLabel(value)}
          </Text>
          <Image
            source={require('../../../assets/images/main/calendar.svg')}
            style={styles.icon}
            accessible={false}
          />
        </Pressable>
        {open && !disabled ? (
          <DateSelection
            label={label}
            value={value}
            maximum={maximum}
            onCancel={() => setOpen(false)}
            onConfirm={(next) => {
              onChange(next);
              setOpen(false);
            }}
            onDismiss={() => trigger.current?.focus()}
          />
        ) : null}
      </View>
    );
  },
);
function DateSelection({
  label,
  value,
  maximum,
  onCancel,
  onConfirm,
  onDismiss,
}: {
  label: string;
  value: string;
  maximum?: string;
  onCancel(): void;
  onConfirm(value: string): void;
  onDismiss(): void;
}) {
  const [draft, setDraft] = useState(() => initialSelection(value, maximum));
  const [year, setYear] = useState(String(draft.year));
  const maxYear = partMaximum(draft, 'year', maximum);
  const validYear =
    /^\d{1,4}$/.test(year) && Number(year) >= 1 && Number(year) <= maxYear;
  const pick = (part: DatePart, next: number) => {
    setDraft((current) =>
      clampSelection({ ...current, [part]: next }, maximum),
    );
    if (part === 'year') setYear(String(next));
  };
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={onCancel}
      onDismiss={onDismiss}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.modalArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.panel}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View
              role="dialog"
              accessibilityLabel={`${label} 선택`}
              accessibilityViewIsModal
              aria-modal
              style={styles.dialog}
            >
              <Text accessibilityRole="header" style={styles.title}>
                {label} 선택
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.preview}>
                {dateLabel(selectionValue(draft))}
              </Text>
              <View style={styles.field}>
                <Text style={styles.label}>연도 바로 입력</Text>
                <TextInput
                  accessibilityLabel="연도 바로 입력"
                  accessibilityHint={`1년부터 ${maxYear}년까지 입력할 수 있어요.`}
                  aria-invalid={!validYear}
                  value={year}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 4);
                    setYear(digits);
                    if (Number(digits) >= 1 && Number(digits) <= maxYear)
                      pick('year', Number(digits));
                  }}
                  selectTextOnFocus
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={4}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={[styles.yearInput, !validYear && styles.invalid]}
                />
                {!validYear ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    1~{maxYear}년 사이의 연도를 입력해주세요.
                  </Text>
                ) : null}
              </View>
              <View style={styles.columns}>
                {(['year', 'month', 'day'] as const).map((part) => (
                  <DateColumn
                    key={part}
                    part={part}
                    selected={draft[part]}
                    maximum={partMaximum(draft, part, maximum)}
                    onChange={(next) => pick(part, next)}
                  />
                ))}
              </View>
              <View style={styles.actions}>
                <ActionButton
                  label="완료"
                  variant="primary"
                  disabled={!validYear}
                  onPress={() => {
                    Keyboard.dismiss();
                    onConfirm(selectionValue(clampSelection(draft, maximum)));
                  }}
                />
                <ActionButton
                  label="취소"
                  variant="tertiary"
                  onPress={onCancel}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const partLabels = { year: '연도', month: '월', day: '일' };
const suffix = { year: '년', month: '월', day: '일' };
function DateColumn({
  part,
  selected,
  maximum,
  onChange,
}: {
  part: DatePart;
  selected: number;
  maximum: number;
  onChange(value: number): void;
}) {
  const list = useRef<FlatList<number>>(null);
  const scroll = useRef<ScrollView>(null);
  const options = useRef(new Map<number, View>());
  const focusNext = useRef<number | null>(null);
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(
    48,
    Math.ceil(typography.button.lineHeight * fontScale + spacing.lg),
  );
  const values = useMemo(
    () =>
      Array.from({ length: maximum }, (_, index) =>
        part === 'year' ? maximum - index : index + 1,
      ),
    [maximum, part],
  );
  const index = values.indexOf(selected);
  useEffect(() => {
    list.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    scroll.current?.scrollTo({
      y: Math.max(0, index - 1) * rowHeight,
      animated: false,
    });
    if (focusNext.current === selected) {
      const option = options.current.get(selected);
      if (option) {
        option.focus();
        focusNext.current = null;
      }
    }
  }, [index, selected, rowHeight]);
  const keyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: KeyboardEvent) => {
            const nextIndex =
              event.key === 'ArrowDown'
                ? Math.min(values.length - 1, index + 1)
                : event.key === 'ArrowUp'
                  ? Math.max(0, index - 1)
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? values.length - 1
                      : null;
            if (nextIndex === null) return;
            event.preventDefault();
            focusNext.current = values[nextIndex];
            onChange(values[nextIndex]);
          },
        }
      : {};
  const option = (item: number) => (
    <Pressable
      key={item}
      ref={(node) => {
        if (node) {
          options.current.set(item, node);
          if (focusNext.current === item) {
            node.focus();
            focusNext.current = null;
          }
        } else options.current.delete(item);
      }}
      accessibilityRole="radio"
      accessibilityLabel={`${item}${suffix[part]}`}
      accessibilityState={{ checked: item === selected }}
      aria-checked={item === selected}
      tabIndex={item === selected ? 0 : -1}
      onPress={() => onChange(item)}
      style={({ pressed }) => [
        styles.option,
        { height: rowHeight },
        item === selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.optionText, item === selected && styles.selectedText]}
      >
        {item}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{partLabels[part]}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`${partLabels[part]} 선택`}
        {...keyboardProps}
      >
        {part === 'year' ? (
          <FlatList
            ref={list}
            testID={`date-${part}-options`}
            data={values}
            style={{ height: rowHeight * 4 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            initialScrollIndex={index}
            initialNumToRender={8}
            windowSize={3}
            getItemLayout={(_, itemIndex) => ({
              length: rowHeight,
              offset: rowHeight * itemIndex,
              index: itemIndex,
            })}
            keyExtractor={(item) => String(item)}
            extraData={selected}
            renderItem={({ item }) => option(item)}
          />
        ) : (
          <ScrollView
            ref={scroll}
            testID={`date-${part}-options`}
            style={{ height: rowHeight * 4 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {values.map(option)}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.text },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.text, flex: 1 },
  icon: { width: 22, height: 22 },
  pressed: { backgroundColor: colors.tint },
  invalid: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  disabledText: { color: colors.muted },
  overlay: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  modalArea: {
    maxHeight: '100%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  panel: { borderRadius: radius.sheet, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  dialog: { gap: spacing.lg },
  title: { ...typography.section, color: colors.heading },
  preview: { ...typography.body, color: colors.text },
  yearInput: {
    ...typography.body,
    color: colors.text,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    outlineColor: colors.primary,
  },
  columns: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1, minWidth: 0 },
  columnLabel: {
    ...typography.label,
    textAlign: 'center',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
  optionText: {
    ...typography.body,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  selectedText: { color: colors.onTint, fontWeight: '700' },
  actions: { gap: spacing.sm },
  error: { ...typography.caption, color: colors.danger },
});
