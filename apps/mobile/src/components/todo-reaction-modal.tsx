import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-provider';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { useReduceMotion } from '../theme/motion';
import { createTodoApi } from '../lib/features/todo/todoApi';
import type { ChildReaction, TodoResponse } from '../lib/features/todo/types';
import { ApiError } from '../lib/api/errors';
import { selectionFeedback, successFeedback } from '../lib/haptics';

export const childReactionLabels: Record<ChildReaction, string> = {
  ENJOYED: '좋아했어요',
  NEUTRAL: '보통이에요',
  DIFFICULT: '어려워했어요',
};

export function TodoReactionModal({
  todo,
  onClose,
  onMemo,
}: {
  todo: TodoResponse;
  onClose(): void;
  onMemo?: () => void;
}) {
  const { client, status, epoch } = useAuth();
  const [openedEpoch] = useState(epoch);
  const [selected, setSelected] = useState<ChildReaction | null>(
    todo.childReaction ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false),
    alive = useRef(true);
  const queryClient = useQueryClient();
  const reduced = useReduceMotion();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const current = () =>
    alive.current && client.getSnapshot().epoch === openedEpoch;
  const close = () => {
    if (!pending.current) onClose();
  };
  const save = async (reaction: ChildReaction | null) => {
    if (pending.current || !current() || status !== 'authenticated') return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await createTodoApi(client).setReaction(
        todo.id,
        reaction,
      );
      if (!current()) return;
      if (
        updated.id !== todo.id ||
        !updated.completed ||
        updated.childReaction !== reaction
      )
        throw new Error('저장 응답을 확인하지 못했어요. 다시 시도해주세요.');
      queryClient.setQueryData<TodoResponse[]>(
        ['todos', todo.scheduledDate],
        (rows) => rows?.map((row) => (row.id === updated.id ? updated : row)),
      );
      void queryClient.invalidateQueries({
        queryKey: ['todos', todo.scheduledDate],
      });
      successFeedback();
      onClose();
    } catch (e) {
      if (current())
        setError(
          e instanceof ApiError && e.status === 409
            ? '완료 상태가 바뀌었어요. 창을 닫고 일정을 다시 확인해주세요.'
            : '반응 저장을 확인하지 못했어요. 선택은 유지돼요. 다시 시도해주세요.',
        );
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  if (epoch !== openedEpoch || status !== 'authenticated') return null;
  return (
    <Modal
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={close}
    >
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.overlay}>
        <SafeAreaView
          edges={['bottom']}
          style={styles.sheet}
          accessibilityViewIsModal
        >
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={({ pressed }) => [
                styles.toolbarButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.later, busy && styles.disabledText]}>
                나중에
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? '저장 중…' : '반응 저장하기'}
              accessibilityState={{ disabled: busy || !selected, busy }}
              disabled={busy || !selected}
              onPress={() => void save(selected)}
              style={({ pressed }) => [
                styles.toolbarButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.save,
                  (busy || !selected) && styles.disabledText,
                ]}
              >
                {busy ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
          >
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                아이의 반응은 어땠나요?
              </Text>
              <Text style={styles.name}>{todo.planName}</Text>
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="활동에 대한 아이의 반응"
              style={styles.choices}
            >
              {(
                Object.entries(childReactionLabels) as [ChildReaction, string][]
              ).map(([value, label], index) => {
                const checked = selected === value;
                return (
                  <View key={value}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      accessibilityRole="radio"
                      aria-checked={checked}
                      accessibilityLabel={label}
                      accessibilityState={{ checked, disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        if (checked) return;
                        selectionFeedback();
                        setSelected(value);
                      }}
                      style={({ pressed }) => [
                        styles.choice,
                        pressed && styles.pressed,
                        checked && styles.selected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          checked && styles.selectedText,
                        ]}
                      >
                        {label}
                      </Text>
                      {checked ? (
                        <Text
                          accessible={false}
                          aria-hidden
                          style={styles.check}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {onMemo || todo.childReaction ? (
              <View style={styles.secondaryActions}>
                {onMemo ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={onMemo}
                    style={styles.secondaryAction}
                  >
                    <Text style={[styles.memo, busy && styles.disabledText]}>
                      일정 메모에 한 줄 남기기
                    </Text>
                  </Pressable>
                ) : null}
                {todo.childReaction ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void save(null)}
                    style={styles.secondaryAction}
                  >
                    <Text style={[styles.remove, busy && styles.disabledText]}>
                      반응 지우기
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '90%',
    flexShrink: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolbarButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  later: { ...typography.label, color: colors.text },
  save: { ...typography.label, fontWeight: '700', color: colors.primary },
  disabledText: { color: colors.muted },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  heading: { gap: spacing.xs },
  title: { ...typography.section, color: colors.heading },
  name: { ...typography.label, color: colors.muted },
  choices: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  choice: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.background },
  selected: { backgroundColor: colors.tint },
  choiceText: { ...typography.button, color: colors.heading, flexShrink: 1 },
  selectedText: { color: colors.onTint },
  check: { ...typography.button, color: colors.primary },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
  },
  secondaryAction: { minHeight: 44, justifyContent: 'center' },
  memo: { ...typography.label, color: colors.onTint },
  remove: { ...typography.label, color: colors.danger },
  error: { ...typography.caption, color: colors.danger },
});
