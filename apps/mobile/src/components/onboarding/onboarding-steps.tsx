import { Pressable, Text, TextInput, View } from 'react-native';
import {
  concernChoices,
  activityChoices,
  toggleConcern,
  withPrematurity,
  localDate,
  type OnboardingProfile,
  type Personalization,
} from '../../lib/onboarding';
import { colors } from '../../theme/colors';
import { styles } from './onboarding-styles';
import { DateField } from './date-field';
export const titles = [
  '아이를 소개해 주세요',
  '요즘 어떤 점이 가장 고민인가요?',
  '우리 아이는 요즘 어떤가요?',
  '우리 가족의 하루를 알려주세요',
  '입력한 정보를 확인해 주세요',
];
export const descriptions = [
  '우리 아이에게 맞는 하루를 준비할게요.',
  '지금 가장 도움이 필요한 부분을 알려주세요.',
  '아이의 최근 모습을 간단히 알려주세요.',
  '함께할 수 있는 시간을 선택해주세요. 건너뛸 수 있어요.',
  '입력한 정보를 확인해 주세요. 아직 AI 루틴이나 추천을 생성한 것은 아니에요.',
];
function Choice({
  label,
  detail,
  selected,
  onPress,
  disabled,
  role = 'radio',
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selected,
        disabled && {
          backgroundColor: colors.disabled,
          borderColor: colors.disabled,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[styles.choiceTitle, disabled && { color: colors.muted }]}>
          {label}
        </Text>
        {detail ? <Text style={styles.hint}>{detail}</Text> : null}
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: colors.primary, fontSize: 20 }}
      >
        {selected ? '●' : '○'}
      </Text>
    </Pressable>
  );
}

export function OnboardingStep({
  step,
  value,
  errors,
  months,
  supportsChoices,
  update,
  choices,
}: {
  step: number;
  value: OnboardingProfile;
  errors: Record<string, string>;
  months: number | null;
  supportsChoices: boolean;
  update(value: OnboardingProfile): void;
  choices(value: Partial<Personalization>): void;
}) {
  return (
    <>
      {step === 0 ? (
        <>
          <Text style={styles.label}>아이 이름 또는 애칭 · 필수</Text>
          <TextInput
            placeholderTextColor={colors.muted}
            accessibilityLabel="아이 이름 또는 애칭"
            placeholder="아이를 어떻게 부르시나요?"
            value={value.name}
            maxLength={50}
            autoCapitalize="none"
            onChangeText={(name) => update({ ...value, name })}
            style={styles.input}
          />
          {errors.name ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.name}
            </Text>
          ) : null}
          <DateField
            label="생년월일"
            value={value.birthday}
            maximum={localDate(new Date())}
            onChange={(birthday) => update({ ...value, birthday })}
          />
          {errors.birthday ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.birthday}
            </Text>
          ) : null}
          {months !== null ? (
            <Text style={styles.hint}>
              현재 {months}개월 · 아이마다 자라는 속도는 달라요.
            </Text>
          ) : null}
          <Text style={styles.label}>조산 여부 · 선택</Text>
          {(
            [
              ['no', '아니요'],
              ['yes', '네'],
              ['unknown', '잘 모르겠어요'],
            ] as const
          ).map(([code, label]) => (
            <Choice
              key={code}
              label={label}
              selected={value.personalization.prematurityStatus === code}
              disabled={!supportsChoices}
              onPress={() =>
                choices(
                  withPrematurity(
                    value.personalization,
                    value.personalization.prematurityStatus === code
                      ? null
                      : code,
                  ),
                )
              }
            />
          ))}
          {value.personalization.prematurityStatus === 'yes' ? (
            <>
              <DateField
                label="출산 예정일"
                value={value.personalization.expectedDueDate ?? ''}
                disabled={!supportsChoices}
                onChange={(expectedDueDate) =>
                  choices({
                    expectedDueDate: expectedDueDate || null,
                  })
                }
              />
              <Text style={styles.hint}>
                예정일은 나중에 입력해도 괜찮아요. 교정월령이나 발달 결과를
                계산하지 않아요.
              </Text>
            </>
          ) : null}
          {errors.expectedDueDate ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.expectedDueDate}
            </Text>
          ) : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Text style={styles.hint}>
            최대 2개를 골라주세요. 선택하지 않아도 괜찮아요.
          </Text>
          {concernChoices.map(([code, label, detail]) => (
            <Choice
              key={code}
              label={label}
              detail={detail}
              role="checkbox"
              disabled={!supportsChoices}
              selected={value.personalization.concerns.includes(code)}
              onPress={() =>
                choices({
                  concerns: toggleConcern(value.personalization.concerns, code),
                })
              }
            />
          ))}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={styles.subtitle}>검토된 질문을 준비하고 있어요.</Text>
          <Text style={styles.body}>
            아이를 평가하거나 다른 아이와 비교하지 않아요. 지금은 답변 없이 다음
            단계로 넘어가도 괜찮아요.
          </Text>
          {months !== null && months > 48 ? (
            <Text style={styles.hint}>
              현재 월령에는 영유아 연령별 질문을 제공하지 않아요.
            </Text>
          ) : null}
        </>
      ) : null}
      {step === 3 ? (
        <>
          {activityChoices.map(([code, label]) => (
            <Choice
              key={code}
              label={label}
              disabled={!supportsChoices}
              selected={value.personalization.availableActivityTime === code}
              onPress={() =>
                choices({
                  availableActivityTime:
                    value.personalization.availableActivityTime === code
                      ? null
                      : code,
                })
              }
            />
          ))}
          <Text style={styles.hint}>
            매일 같지 않아도 괜찮아요. 기상·식사·낮잠 등 세부 시간표는 루틴을
            정할 때 추가할 수 있어요.
          </Text>
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Text style={styles.summaryName}>{value.name.trim()}</Text>
          <Text style={styles.body}>
            {value.birthday} · {months}개월
          </Text>
          {value.personalization.concerns.length ? (
            <>
              <Text style={styles.label}>요즘의 고민</Text>
              <Text style={styles.body}>
                {value.personalization.concerns
                  .map((code) => concernChoices.find((c) => c[0] === code)?.[1])
                  .join(' · ')}
              </Text>
            </>
          ) : null}
          {value.personalization.availableActivityTime ? (
            <>
              <Text style={styles.label}>함께할 시간</Text>
              <Text style={styles.body}>
                {
                  activityChoices.find(
                    (c) => c[0] === value.personalization.availableActivityTime,
                  )?.[1]
                }
              </Text>
            </>
          ) : null}
          <Text style={styles.hint}>
            필요한 정보만 담았어요. 나중에 아이 프로필에서 수정할 수 있어요.
          </Text>
        </>
      ) : null}
    </>
  );
}
