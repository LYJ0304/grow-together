import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { ActionButton } from './action-button';
import { MotionPressable } from './motion-pressable';
import { colors } from '../theme/colors';
import { editorial } from '../theme/editorial';
import { typography } from '../theme/typography';
import { useReduceMotion } from '../theme/motion';

export function HomeQuickAdd({
  authenticated,
  allowDiary = true,
  onClose,
  onDiary,
  onSchedule,
  onRecommend,
}: {
  authenticated: boolean;
  allowDiary?: boolean;
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
          <Text style={editorial.eyebrow}>
            {allowDiary ? '하루의 기록' : '하루의 계획'}
          </Text>
          <Text accessibilityRole="header" style={editorial.section}>
            {allowDiary ? '무엇을 남길까요?' : '어떤 활동을 계획할까요?'}
          </Text>
          <Text style={editorial.description}>
            지금 하고 싶은 일을 골라주세요.
          </Text>
          {[
            {
              label: '하루의 순간 기록하기',
              action: onDiary,
              disabled: !allowDiary,
            },
            {
              label: '일정 직접 추가하기',
              action: onSchedule,
              disabled: !authenticated,
            },
            {
              label: 'AI 활동 추천받기',
              detail: '가능한 시간에 맞는 활동을 찾아요.',
              action: onRecommend,
              disabled: !authenticated,
            },
          ].map((item) => (
            <MotionPressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.detail}
              disabled={item.disabled}
              accessibilityState={{ disabled: item.disabled }}
              onPress={item.action}
              style={[
                styles.choice,
                item.detail && !item.disabled && styles.recommendation,
                item.disabled && styles.disabled,
              ]}
            >
              <View style={styles.choiceCopy}>
                <Text
                  style={[styles.label, item.disabled && styles.disabledText]}
                >
                  {item.label}
                </Text>
                {item.detail && !item.disabled ? (
                  <Text style={styles.detail}>{item.detail}</Text>
                ) : null}
              </View>
              <Text accessible={false} style={styles.chevron}>
                ›
              </Text>
            </MotionPressable>
          ))}
          {!allowDiary ? (
            <Text style={editorial.description}>
              미래 날짜는 함께할 활동을 먼저 계획해보세요.
            </Text>
          ) : null}
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
  choiceCopy: { flex: 1, gap: 2 },
  label: { ...typography.label, color: colors.text },
  detail: { ...typography.caption, color: colors.muted },
  recommendation: { backgroundColor: colors.tint, borderColor: colors.tint },
  disabledText: { color: colors.muted },
  chevron: { fontSize: 24, color: colors.muted },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
});
