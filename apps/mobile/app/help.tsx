import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SettingsScreen } from '../src/components/settings/settings-screen';
import { ActionButton } from '../src/components/action-button';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';

const questions = [
  {
    id: 'child',
    question: '아이 정보는 어디서 등록하거나 수정하나요?',
    answer:
      '하단 마이 탭에서 아이 정보 관리를 열어주세요. 아이가 등록되어 있지 않으면 아이 추가를, 등록되어 있으면 수정을 눌러 기본 정보를 입력할 수 있어요.',
  },
  {
    id: 'schedule',
    question: '일정을 직접 추가하고 싶어요.',
    answer:
      '캘린더에서 날짜를 선택한 뒤 일정 영역의 일정 추가를 눌러주세요. 직접 추가에서 활동 이름과 시간을 입력해 일정을 만들 수 있어요.',
  },
  {
    id: 'complete',
    question: '완료한 활동은 어떻게 표시하나요?',
    answer:
      '홈이나 캘린더의 일정에서 활동 옆 체크 버튼을 눌러주세요. 저장이 완료되면 완료 상태가 반영되고, 아이의 반응을 남길 수 있어요.',
  },
  {
    id: 'diary',
    question: '일기를 작성하고 사진을 첨부하려면 어떻게 하나요?',
    answer:
      '홈의 일기 작성 버튼이나 캘린더에서 선택한 날짜의 일기 작성하기를 눌러주세요. 본문을 입력하고 사진을 추가한 뒤 일기 저장하기를 누르면 돼요.',
  },
];
export default function HelpScreen() {
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <SettingsScreen title="도움말">
      <Text style={styles.intro}>자주 묻는 질문을 모았어요.</Text>
      <View style={styles.list}>
        {questions.map(({ id, question, answer }, index) => {
          const expanded = opened === id;
          return (
            <View key={id} style={index > 0 ? styles.divider : undefined}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={question}
                accessibilityState={{ expanded }}
                aria-expanded={expanded}
                onPress={() => setOpened(expanded ? null : id)}
                style={({ pressed }) => [
                  styles.question,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.questionText}>{question}</Text>
                <Text accessible={false} style={styles.mark}>
                  {expanded ? '−' : '+'}
                </Text>
              </Pressable>
              {expanded ? <Text style={styles.answer}>{answer}</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.support}>
        <Text style={styles.questionText}>찾는 답변이 없나요?</Text>
        <ActionButton
          label="문의하기"
          variant="secondary"
          onPress={() => router.push('/contact')}
        />
      </View>
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.muted },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  question: {
    minHeight: 56,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  questionText: { ...typography.label, color: colors.heading, flexShrink: 1 },
  mark: { ...typography.section, color: colors.muted },
  answer: {
    ...typography.body,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  pressed: { backgroundColor: colors.tint },
  support: { gap: spacing.md },
});
