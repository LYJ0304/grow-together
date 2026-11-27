import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SettingsScreen } from '../src/components/settings/settings-screen';
import { ActionButton } from '../src/components/action-button';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/radius';

const categories = ['이용 문의', '오류 제보', '개선 제안'] as const;
export default function ContactScreen() {
  const [category, setCategory] = useState<string>(categories[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  useFocusEffect(
    useCallback(() => {
      setCategory(categories[0]);
      setTitle('');
      setContent('');
    }, []),
  );
  return (
    <SettingsScreen title="문의하기">
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>문의 접수 기능은 준비 중이에요.</Text>
        <Text style={styles.body}>
          작성 내용은 전송·저장되지 않아요. 화면을 나가면 입력한 내용이
          사라져요.
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>문의 유형</Text>
        <View
          style={styles.categories}

          accessibilityLabel="문의 유형"
        >
          {categories.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={value}
              accessibilityState={{ selected: category === value }}
              aria-pressed={category === value}
              onPress={() => setCategory(value)}
              style={({ pressed }) => [
                styles.choice,
                category === value && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.body, category === value && styles.selectedText]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>제목</Text>
        <TextInput
          accessibilityLabel="문의 제목"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="궁금한 점을 짧게 적어주세요"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoComplete="off"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>내용</Text>
        <TextInput
          accessibilityLabel="문의 내용"
          value={content}
          onChangeText={setContent}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          placeholder="어떤 점이 궁금하거나 불편했나요?"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.content]}
          autoComplete="off"
        />
        <Text style={styles.hint}>
          {content.length}/2000자 · 이름·연락처·아이의 건강정보 등 민감한
          개인정보는 적지 말아주세요.
        </Text>
      </View>
      <ActionButton
        label="문의 보내기"
        variant="primary"
        disabled
        onPress={() => {}}
      />
    </SettingsScreen>
  );
}
const styles = StyleSheet.create({
  notice: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.tint,
    gap: spacing.sm,
  },
  noticeTitle: { ...typography.label, color: colors.onTint },
  body: { ...typography.body, color: colors.text },
  field: { gap: spacing.sm },
  label: { ...typography.label, color: colors.heading },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
  selectedText: { color: colors.onTint },
  pressed: { backgroundColor: colors.secondaryPressed },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radius.md,
    minHeight: 52,
    padding: spacing.md,
  },
  content: { minHeight: 168 },
  hint: { ...typography.caption, color: colors.muted },
});
