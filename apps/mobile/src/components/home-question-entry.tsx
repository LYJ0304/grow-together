import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useChatDraft } from './auth-provider';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

const suggestions = [
  ['놀이 추천', '오늘 집에서 할 놀이를 추천해줘'],
  ['아이 발달', '아이 발달에 대해 궁금한 점이 있어요'],
  ['육아 고민', '육아 고민을 함께 정리하고 싶어요'],
];

export function HomeQuestionEntry() {
  const { draft, setDraft } = useChatDraft();
  const input = useRef<TextInput>(null);
  const [notice, setNotice] = useState('');
  const openChat = () =>
    router.navigate({ pathname: '/chat', params: { compose: 'true' } });
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        무엇이 궁금하세요?
      </Text>
      <View style={styles.surface}>
        <TextInput
          selectionColor={colors.primary}
          ref={input}
          accessibilityLabel="홈 질문 입력"
          placeholder="오늘의 육아 고민을 적어보세요"
          placeholderTextColor={colors.muted}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setNotice('');
          }}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="질문 이어서 보내기"
          accessibilityHint="질문 초안을 유지하고 육아 도우미로 이동해요"
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          onPress={openChat}
          style={({ pressed }) => [
            styles.send,
            !draft.trim() && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.arrow}>↑</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {suggestions.map(([label, question]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => {
              if (draft.trim()) {
                setNotice('작성 중인 질문을 먼저 마무리해주세요.');
                input.current?.focus();
              } else {
                setDraft(question);
                openChat();
              }
            }}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        답변 연결 준비 중 · 질문 초안은 이 세션에서 유지돼요.
      </Text>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.tint,
  },
  title: {
    ...typography.section,
    fontSize: 24,
    lineHeight: 34,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  surface: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    outlineColor: colors.primary,
    ...typography.body,
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    maxHeight: 140,
    color: colors.text,
    textAlignVertical: 'top',
    padding: spacing.xs,
  },
  send: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: { fontSize: 24, color: colors.surface },
  disabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.caption, color: colors.primary },
  hint: { ...typography.caption, color: colors.muted },
});
