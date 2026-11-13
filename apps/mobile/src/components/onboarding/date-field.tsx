import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { localDate, parseDate } from '../../lib/onboarding';
import { ActionButton } from '../action-button';
export type DateFieldProps = {
  label: string;
  value: string;
  onChange(value: string): void;
  maximum?: string;
  disabled?: boolean;
};
export function DateField({
  label,
  value,
  onChange,
  maximum,
  disabled,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={{
          padding: 14,
          minHeight: 52,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.controlBorder,
        }}
      >
        <Text style={{ color: colors.text }}>{value || '날짜 선택'}</Text>
      </Pressable>
      {open && !disabled ? (
        <>
          <DateTimePicker
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            value={parseDate(value) ?? new Date()}
            maximumDate={
              maximum ? (parseDate(maximum) ?? undefined) : undefined
            }
            onChange={(event, date) => {
              if (Platform.OS !== 'ios') setOpen(false);
              if (event.type === 'set' && date) onChange(localDate(date));
            }}
          />
          {Platform.OS === 'ios' ? (
            <ActionButton
              label="날짜 선택 완료"
              variant="primary"
              onPress={() => setOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
