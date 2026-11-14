import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { localDate, parseDate, dateLabel } from '../../lib/onboarding';
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
    const [draft, setDraft] = useState(new Date());
    const trigger = useRef<View>(null);
    const begin = () => {
      if (disabled) return;
      Keyboard.dismiss();
      const initial = parseDate(value) ?? new Date();
      const limit = maximum ? parseDate(maximum) : null;
      setDraft(limit && initial > limit ? limit : initial);
      setOpen(true);
    };
    const close = () => {
      setOpen(false);
      trigger.current?.focus();
    };
    useImperativeHandle(ref, () => ({ focus: begin }));
    const commit = (date: Date) => {
      const next = localDate(date);
      if (!maximum || next <= maximum) onChange(next);
      close();
    };
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text }}>
          {label}
          {required ? ' (필수)' : ''}
        </Text>
        <Pressable
          ref={trigger}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: dateLabel(value) }}
          accessibilityHint={error ?? '연도, 월, 일을 선택해주세요.'}
          accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
          disabled={disabled}
          onPress={begin}
          style={{
            padding: 14,
            minHeight: 52,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.controlBorder,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.text }}>{dateLabel(value)}</Text>
        </Pressable>
        {open && !disabled ? (
          <>
            <DateTimePicker
              mode="date"
              locale="ko-KR"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              value={draft}
              maximumDate={
                maximum ? (parseDate(maximum) ?? undefined) : undefined
              }
              onChange={(event, date) => {
                if (event.type !== 'set' || !date) {
                  close();
                  return;
                }
                if (Platform.OS === 'ios') setDraft(date);
                else commit(date);
              }}
            />
            {Platform.OS === 'ios' ? (
              <>
                <ActionButton
                  label="날짜 선택 완료"
                  variant="primary"
                  onPress={() => commit(draft)}
                />
                <ActionButton
                  label="날짜 선택 취소"
                  variant="tertiary"
                  onPress={close}
                />
              </>
            ) : null}
          </>
        ) : null}
      </View>
    );
  },
);
