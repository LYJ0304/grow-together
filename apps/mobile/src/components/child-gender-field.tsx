import { Pressable, StyleSheet, Text, View } from 'react-native';
import { childGenderLabels, type ChildGender } from '../lib/child-profile';
import { buttonLabel, buttonSurface } from '../theme/buttons';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function ChildGenderField({
  value,
  onChange,
  disabled = false,
}: {
  value?: ChildGender;
  onChange: (value: ChildGender) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>성별 (선택)</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="성별"
        style={styles.options}
      >
        {(Object.keys(childGenderLabels) as ChildGender[]).map((gender) => {
          const checked = value === gender;
          const variant = checked ? 'secondary' : 'tertiary';
          return (
            <Pressable
              key={gender}
              accessibilityRole="radio"
              aria-checked={checked}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              onPress={() => onChange(gender)}
              style={({ pressed }) => [
                styles.option,
                buttonSurface(variant, disabled, pressed),
                checked && !disabled && styles.selected,
              ]}
            >
              <Text style={[typography.button, buttonLabel(variant, disabled)]}>
                {childGenderLabels[gender]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.text },
  options: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  selected: { borderColor: colors.primary },
});
