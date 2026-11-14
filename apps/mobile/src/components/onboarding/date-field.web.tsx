import {
  createElement,
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
} from 'react';
import type { DateFieldHandle, DateFieldProps } from './date-field';
import { colors } from '../../theme/colors';
import { dateLabel } from '../../lib/onboarding';
export const DateField = forwardRef<DateFieldHandle, DateFieldProps>(
  function DateField(
    { label, value, onChange, maximum, disabled, error, required },
    ref,
  ) {
    const input = useRef<HTMLInputElement>(null);
    const description = useId();
    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
    return createElement(
      'label',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
          color: colors.text,
        },
      },
      `${label}${required ? ' (필수)' : ''}`,
      createElement('input', {
        ref: input,
        type: 'date',
        lang: 'ko-KR',
        'aria-label': label,
        'aria-invalid': Boolean(error),
        'aria-describedby': description,
        value,
        max: maximum,
        disabled,
        required,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
        style: {
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 52,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${error ? colors.danger : colors.controlBorder}`,
          background: colors.surface,
          outlineColor: colors.primary,
          color: colors.text,
          fontSize: 16,
          fontFamily: 'inherit',
        },
      }),
      createElement(
        'span',
        { id: description, style: { color: colors.muted } },
        error ?? (value ? dateLabel(value) : '연도, 월, 일을 선택해주세요.'),
      ),
    );
  },
);
