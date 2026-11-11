import { useRef } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from './typography';
import { useReduceMotion } from '../theme/motion';
import { ActionButton } from './action-button';

export function ChildRegistrationModal({
  error,
  checking,
  onRegister,
  onRetry,
  onClose,
}: {
  error: boolean;
  checking: boolean;
  onRegister(): void;
  onRetry(): void;
  onClose(): void;
}) {
  const reduced = useReduceMotion();
  const heading = useRef<Text>(null);
  const title = error
    ? '아이 정보를 확인하지 못했어요'
    : '우리 아이를 등록해주세요';
  return (
    <Modal
      transparent
      visible
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
      onShow={() => {
        if (Platform.OS === 'web') {
          const node = heading.current as unknown as HTMLElement | null;
          node?.setAttribute('tabindex', '-1');
          node?.focus();
        }
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <View
          role="dialog"
          aria-label={title}
          accessibilityViewIsModal
          style={styles.card}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View accessible={false} style={styles.accent} />
            <Text ref={heading} accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.body}>
              {error
                ? '등록 여부를 확인할 수 없어요. 연결을 확인하고 다시 시도해주세요.'
                : '아이의 성장 단계에 맞는 일정과 루틴을 추천하려면 아이의 기본 정보가 필요해요.'}
            </Text>
            <ActionButton
              label={
                error
                  ? checking
                    ? '확인 중…'
                    : '아이 정보 다시 확인'
                  : '아이 정보 등록하기'
              }
              disabled={checking}
              onPress={error ? onRetry : onRegister}
            />
            <ActionButton
              label={error ? '닫기' : '나중에 등록하기'}
              secondary
              onPress={onClose}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  content: { padding: 24, gap: 18 },
  accent: {
    width: 36,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  title: { ...typography.title, color: colors.text, outlineWidth: 0 },
  body: { ...typography.body, color: colors.text },
});
