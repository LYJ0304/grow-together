import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from './action-button';
import { MotionPressable } from './motion-pressable';
import { colors } from '../theme/colors';
import { editorial } from '../theme/editorial';
import { typography } from '../theme/typography';
import { useReduceMotion } from '../theme/motion';

export function HomeQuickAdd({
  authenticated,
  onClose,
  onDiary,
  onSchedule,
  onRecommend,
}: {
  authenticated: boolean;
  onClose: () => void;
  onDiary: () => void;
  onSchedule: () => void;
  onRecommend: () => void;
}) {
  const reduced = useReduceMotion();
  return (
    <Modal
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          onPress={onClose}
        />
        <ScrollView
          role="dialog"
          accessibilityLabel="빠른 추가"
          accessibilityViewIsModal
          style={styles.sheet}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View accessible={false} style={styles.handle} />
          <Text style={editorial.eyebrow}>하루의 기록</Text>
          <Text accessibilityRole="header" style={editorial.section}>
            무엇을 남길까요?
          </Text>
          <Text style={editorial.description}>
            지금 하고 싶은 일을 골라주세요.
          </Text>
          {[
            { label: '하루의 순간 기록하기', action: onDiary, disabled: false },
            {
              label: '일정 직접 추가하기',
              action: onSchedule,
              disabled: !authenticated,
            },
            {
              label: 'AI 활동 추천받기',
              action: onRecommend,
              disabled: !authenticated,
            },
          ].map((item) => (
            <MotionPressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={item.disabled}
              accessibilityState={{ disabled: item.disabled }}
              onPress={item.action}
              style={[styles.choice, item.disabled && styles.disabled]}
            >
              <Text
                style={[styles.label, item.disabled && { color: colors.muted }]}
              >
                {item.label}
              </Text>
              <Text accessible={false} style={styles.chevron}>
                ›
              </Text>
            </MotionPressable>
          ))}
          {!authenticated ? (
            <Text style={editorial.description}>
              일정 추가와 AI 활동 추천은 로그인 후 이용할 수 있어요.
            </Text>
          ) : null}
          <ActionButton label="닫기" variant="tertiary" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    flexGrow: 0,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: 26,
  },
  content: { padding: 22, gap: 14 },
  handle: {
    width: 38,
    height: 5,
    backgroundColor: colors.disabled,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 6,
  },
  choice: {
    ...editorial.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingVertical: 12,
  },
  label: { ...typography.label, color: colors.text, flex: 1 },
  chevron: { fontSize: 24, color: colors.muted },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
});
