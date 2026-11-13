import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-provider';
import { ActionButton } from './action-button';
import { typography } from './typography';
import { colors } from '../theme/colors';
import { editorial } from '../theme/editorial';
import { useReduceMotion } from '../theme/motion';
import { createTodoApi } from '../lib/features/todo/todoApi';
import type { ChildReaction, TodoResponse } from '../lib/features/todo/types';
import { ApiError } from '../lib/api/errors';
import { successFeedback } from '../lib/haptics';

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
      <SafeAreaView style={styles.overlay}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.sheet}
          accessibilityViewIsModal
        >
          <Text accessibilityRole="header" style={styles.title}>
            아이의 반응은 어땠나요?
          </Text>
          <Text style={styles.name}>{todo.planName}</Text>
          <Text style={styles.caption}>
            일정 완료는 저장됐어요. 반응은 나중에 남겨도 괜찮아요.
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="활동에 대한 아이의 반응"
            style={styles.choices}
          >
            {(
              Object.entries(childReactionLabels) as [ChildReaction, string][]
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                aria-checked={selected === value}
                accessibilityLabel={label}
                accessibilityState={{
                  checked: selected === value,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => setSelected(value)}
                style={({ pressed }) => [
                  styles.choice,
                  selected === value && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.choiceText}>
                  {selected === value ? '✓ ' : ''}
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <ActionButton
            label={busy ? '저장 중…' : '반응 저장하기'}
            variant="primary"
            disabled={busy || !selected}
            onPress={() => void save(selected)}
          />
          {todo.childReaction ? (
            <ActionButton
              label="반응 지우기"
              variant="tertiary"
              disabled={busy}
              onPress={() => void save(null)}
            />
          ) : null}
          {onMemo ? (
            <ActionButton
              label="일정 메모에 한 줄 남기기"
              disabled={busy}
              onPress={onMemo}
            />
          ) : null}
          <ActionButton
            label="나중에"
            variant="tertiary"
            disabled={busy}
            onPress={close}
          />
        </ScrollView>
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
  scroll: {
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sheet: {
    ...editorial.card,
    gap: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  title: { ...typography.section, color: colors.heading },
  name: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  choices: { gap: 10 },
  choice: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 14,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
  pressed: { backgroundColor: colors.tint },
  choiceText: { ...typography.button, color: colors.onTint },
  error: { ...typography.caption, color: colors.danger },
});
