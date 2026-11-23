import {
  type ComponentRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  type KeyDownEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from '@/components/safe-area-view';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { typography } from '../typography';
import { dateLabel, parseDate } from '../../lib/onboarding';
import { selectionFeedback } from '../../lib/haptics';
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
    const trigger = useRef<ComponentRef<typeof View>>(null);
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
export function DateSelection({
  label,
  value,
  maximum,
  minimumYear = 1,
  onCancel,
  onConfirm,
  onDismiss,
}: {
  label: string;
  value: string;
  maximum?: string;
  minimumYear?: number;
  onCancel(): void;
  onConfirm(value: string): void;
  onDismiss(): void;
}) {
  const [draft, setDraft] = useState(() => initialSelection(value, maximum));
  const pick = (part: DatePart, next: number) => {
    setDraft((current) =>
      current[part] === next
        ? current
        : clampSelection({ ...current, [part]: next }, maximum),
    );
  };
  return (
    <Modal
      transparent
      animationType="none"
      onRequestClose={onCancel}
      onDismiss={onDismiss}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalArea}>
          <View
            role="dialog"
            accessibilityLabel={`${label} 선택`}
            accessibilityViewIsModal
            aria-modal
            style={styles.panel}
          >
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text accessibilityRole="header" style={styles.title}>
                {label} 선택
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.preview}>
                {dateLabel(selectionValue(draft))}
              </Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  accessibilityLabel={label}
                  mode="date"
                  display="spinner"
                  locale="ko-KR"
                  themeVariant="light"
                  style={styles.iosPicker}
                  value={parseDate(selectionValue(draft)) ?? new Date()}
                  minimumDate={
                    parseDate(
                      selectionValue({ year: minimumYear, month: 1, day: 1 }),
                    ) ?? undefined
                  }
                  maximumDate={parseDate(maximum ?? '9999-12-31') ?? undefined}
                  onValueChange={(_, date) => {
                    const next = clampSelection(
                      {
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        day: date.getDate(),
                      },
                      maximum,
                    );
                    if (selectionValue(next) === selectionValue(draft)) return;
                    selectionFeedback();
                    setDraft(next);
                  }}
                />
              ) : (
                <View style={styles.columns}>
                  {(['year', 'month', 'day'] as const).map((part) => (
                    <DateColumn
                      key={part}
                      part={part}
                      selected={draft[part]}
                      minimum={part === 'year' ? minimumYear : 1}
                      maximum={partMaximum(draft, part, maximum)}
                      onChange={(next) => pick(part, next)}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.action}>
                <ActionButton
                  label="취소"
                  variant="tertiary"
                  onPress={onCancel}
                />
              </View>
              <View style={styles.action}>
                <ActionButton
                  label="완료"
                  variant="primary"
                  onPress={() =>
                    onConfirm(selectionValue(clampSelection(draft, maximum)))
                  }
                />
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const visibleRows = 5;
const settleDelay = 120;
const partLabels = { year: '연도', month: '월', day: '일' };
const suffix = { year: '년', month: '월', day: '일' };
function DateColumn({
  part,
  selected,
  maximum,
  minimum = 1,
  onChange,
}: {
  part: DatePart;
  selected: number;
  maximum: number;
  minimum?: number;
  onChange(value: number): void;
}) {
  const list = useRef<FlatList<number>>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const options = useRef(new Map<number, ComponentRef<typeof View>>());
  const focusNext = useRef<number | null>(null);
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(
    48,
    Math.ceil(typography.button.lineHeight * fontScale + spacing.lg),
  );
  const values = useMemo(
    () =>
      Array.from({ length: maximum - minimum + 1 }, (_, index) =>
        part === 'year' ? maximum - index : index + 1,
      ),
    [maximum, minimum, part],
  );
  const index = Math.max(0, values.indexOf(selected));
  const offset = useRef(-1);
  const dragging = useRef(false);
  const coasting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSettle = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const centerRow = (nextIndex: number) => {
    const y = nextIndex * rowHeight;
    if (Math.abs(offset.current - y) < 1) return;
    offset.current = y;
    list.current?.scrollToOffset({ offset: y, animated: false });
    scroll.current?.scrollTo({ y, animated: false });
  };
  const settle = () => {
    cancelSettle();
    if (dragging.current) return;
    const nextIndex = Math.max(
      0,
      Math.min(values.length - 1, Math.round(offset.current / rowHeight)),
    );
    centerRow(nextIndex);
    if (values[nextIndex] !== selected) onChange(values[nextIndex]);
  };
  const scheduleSettle = () => {
    cancelSettle();
    if (!dragging.current && !coasting.current)
      timer.current = setTimeout(settle, settleDelay);
  };
  const trackScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    scheduleSettle();
  };
  useEffect(() => {
    cancelSettle();
    centerRow(index);
    if (focusNext.current === selected) {
      const option = options.current.get(selected);
      if (option) {
        option.focus();
        focusNext.current = null;
      }
    }
    return cancelSettle;
    // Only re-center when the selected row or its geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, selected, rowHeight, values]);
  const wheelProps = {
    style: { height: rowHeight * visibleRows },
    contentContainerStyle: { paddingVertical: rowHeight * 2 },
    scrollEventThrottle: 16,
    nestedScrollEnabled: true,
    showsVerticalScrollIndicator: true,
    indicatorStyle: 'black' as const,
    persistentScrollbar: true,
    automaticallyAdjustContentInsets: false,
    contentInsetAdjustmentBehavior: 'never' as const,
    keyboardShouldPersistTaps: 'handled' as const,
    onLayout: () => {
      offset.current = -1;
      centerRow(index);
    },
    onScroll: trackScroll,
    ...(Platform.OS === 'web'
      ? {}
      : {
          bounces: false,
          snapToInterval: rowHeight,
          snapToAlignment: 'start' as const,
          disableIntervalMomentum: true,
          decelerationRate: 'fast' as const,
          onScrollBeginDrag: () => {
            coasting.current = false;
            dragging.current = true;
            cancelSettle();
          },
          onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            dragging.current = false;
            trackScroll(event);
          },
          onMomentumScrollBegin: () => {
            coasting.current = true;
            cancelSettle();
          },
          onMomentumScrollEnd: (
            event: NativeSyntheticEvent<NativeScrollEvent>,
          ) => {
            coasting.current = false;
            offset.current = event.nativeEvent.contentOffset.y;
            settle();
          },
        }),
  };
  const keyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: KeyDownEvent) => {
            const { key } = event.nativeEvent;
            const nextIndex =
              key === 'ArrowDown'
                ? Math.min(values.length - 1, index + 1)
                : key === 'ArrowUp'
                  ? Math.max(0, index - 1)
                  : key === 'Home'
                    ? 0
                    : key === 'End'
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
      onPress={() => {
        cancelSettle();
        centerRow(values.indexOf(item));
        onChange(item);
      }}
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
            {...wheelProps}
            initialNumToRender={8}
            windowSize={5}
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
            {...wheelProps}
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
    flexShrink: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  panel: {
    flexShrink: 1,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  body: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { ...typography.section, color: colors.heading },
  preview: { ...typography.body, color: colors.text },
  iosPicker: { height: 216, width: '100%' },
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  action: { flex: 1 },
});
