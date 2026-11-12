import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useChatDraft } from './auth-provider';
import { ActionButton } from './action-button';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';

// Opening the composer never replaces an existing question with a generated prompt.
export function HomeQuestionEntry({
  currentDay = true,
}: {
  currentDay?: boolean;
}) {
  const { draft } = useChatDraft();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        하루 대화
      </Text>
      <Text style={styles.body}>
        {draft.trim()
          ? '작성 중인 질문을 이어서 나눠보세요.'
          : '궁금했던 점이나 기억하고 싶은 순간을 적어보세요.'}
      </Text>
      <ActionButton
        motionEnabled
        label={currentDay ? '오늘 이야기 나누기' : '이날 이야기 나누기'}
        onPress={() =>
          router.navigate({ pathname: '/chat', params: { compose: 'true' } })
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { ...typography.section, color: colors.heading },
  body: { ...typography.body, color: colors.muted },
});
