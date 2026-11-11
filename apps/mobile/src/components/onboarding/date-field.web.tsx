import { createElement } from 'react';
import type { DateFieldProps } from './date-field';
import { colors } from '../../theme/colors';
export function DateField({
  label,
  value,
  onChange,
  maximum,
  disabled,
}: DateFieldProps) {
  return createElement(
    'label',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        color: colors.text,
      },
    },
    label,
    createElement('input', {
      type: 'date',
      'aria-label': label,
      value,
      max: maximum,
      disabled,
      onChange: (event: { target: { value: string } }) =>
        onChange(event.target.value),
      style: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 52,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${colors.controlBorder}`,
        background: colors.surface,
        outlineColor: colors.primary,
        color: colors.text,
        fontSize: 16,
      },
    }),
  );
}
