import { colors } from '../theme/colors';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActionButton } from './action-button';
import { typography } from './typography';

export function RecommendationOptions({ onDirect }: { onDirect: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <View style={{ gap: 12 }}>
      <Text style={[typography.body, { color: colors.text }]}>
        오늘은 얼마나 여유가 있나요? 선택하지 않아도 괜찮아요.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['5분 정도', '조금 여유 있어요'].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === label }}
            onPress={() => setChoice(label)}
            style={{
              minHeight: 44,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor:
                choice === label ? colors.primary : colors.controlBorder,
              backgroundColor: choice === label ? colors.tint : colors.surface,
            }}
          >
            <Text style={[typography.label, { color: colors.onTint }]}>
              {choice === label ? '✓ ' : ''}
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[typography.caption, { color: colors.muted }]}>
        활동 추천 연결 준비 중이에요.{' '}
        {choice
          ? `${choice} 선택은 아직 추천 요청으로 전송되지 않아요.`
          : '지금은 직접 일정을 추가할 수 있어요.'}
      </Text>
      <ActionButton label="직접 정할게요" onPress={onDirect} secondary />
    </View>
  );
}
