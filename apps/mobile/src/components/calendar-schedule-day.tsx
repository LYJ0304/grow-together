import { ScheduleSkeleton } from './skeleton';
import { isInitialLoading } from '../lib/loading-state';
import { CalendarSectionHeader } from '@/components/calendar-section-header';
import { spacing } from '@/theme/spacing';
import {
  TodoReactionModal,
  childReactionLabels,
} from '@/components/todo-reaction-modal';
import { useChildRegistration } from '@/components/child-registration';
import { ScheduleCheck } from '@/components/schedule-check';
import { colors } from '@/theme/colors';
import { successFeedback } from '@/lib/haptics';
import { router } from 'expo-router';
import { ScheduleGenerationModal } from '@/components/schedule-generation-modal';
import { SymbolView } from 'expo-symbols';
import { typography } from '@/components/typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { diaryDateKey, parseDiaryDate } from '@/lib/diary-date';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { AddPlanModal } from '@/components/add-plan-modal';
import { useAuth } from '@/components/auth-provider';
import { ApiError } from '@/lib/api/errors';
import { createDiaryApi } from '@/lib/features/diary/diaryApi';
import { createTodoApi } from '@/lib/features/todo/todoApi';
import type { TodoRequest, TodoResponse } from '@/lib/features/todo/types';
export function CalendarScheduleDay({
  dateKey,
  action,
  onActionHandled,
}: {
  dateKey: string;
  action?: 'add' | 'recommend';
  onActionHandled(): void;
}) {
  const { client, status, epoch } = useAuth();
  const requestChild = useChildRegistration();
  const [reactionTodo, setReactionTodo] = useState<TodoResponse | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{
    date: Date;
    todo?: TodoResponse;
  } | null>(null);
  const [managedTodo, setManagedTodo] = useState<TodoResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleting = useRef(false);
  const completing = useRef(false);
  const [completionError, setCompletionError] = useState('');
  const api = createTodoApi(client);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: number;
      input: TodoRequest;
      previousDate?: string;
    }) => {
      if (id === undefined) await api.createTodo(input);
      else await api.updateTodo(id, input);
    },
    retry: false,
    onSuccess: (_result, { input, previousDate }) => {
      void queryClient.invalidateQueries({ queryKey: ['todoMonth'] });
      void queryClient.invalidateQueries({ queryKey: ['diaryByDate'] });
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      if (previousDate && previousDate !== input.scheduledDate) {
        void queryClient.invalidateQueries({
          queryKey: ['todos', previousDate],
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ['todos', input.scheduledDate],
      });
    },
  });
  const remove = useMutation({
    mutationFn: (todo: TodoResponse) => api.deleteTodo(todo.id),
    retry: false,
    onSuccess: (_result, todo) => {
      void queryClient.invalidateQueries({ queryKey: ['todoMonth'] });
      void queryClient.invalidateQueries({ queryKey: ['diaryByDate'] });
      void queryClient.invalidateQueries({ queryKey: ['savedDiary'] });
      void queryClient.invalidateQueries({
        queryKey: ['todos', todo.scheduledDate],
      });
    },
  });
  const completion = useMutation({
    mutationFn: (todo: TodoResponse) =>
      api.setCompletion(todo.id, !todo.completed),
    retry: false,
    onSuccess: (_result, todo) =>
      queryClient.invalidateQueries({
        queryKey: ['todos', todo.scheduledDate],
      }),
  });
  const toggleCompletion = async (todo: TodoResponse) => {
    if (completing.current) return;
    completing.current = true;
    setCompletionError('');
    try {
      const updated = await completion.mutateAsync(todo);
      if (client.getSnapshot().epoch !== epoch) return;
      if (updated.completed) {
        successFeedback();
        setReactionTodo(updated);
      }
    } catch {
      setCompletionError(
        '완료 상태를 저장하지 못했어요. 목록 새로고침으로 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      completing.current = false;
    }
  };
  const closeMenu = () => {
    if (deleting.current) return;
    setManagedTodo(null);
    setConfirmDelete(false);
    setDeleteError('');
  };
  const deleteTodo = async () => {
    if (!managedTodo || deleting.current) return;
    deleting.current = true;
    setDeleteError('');
    try {
      await remove.mutateAsync(managedTodo);
      setManagedTodo(null);
      setConfirmDelete(false);
      setNotice('계획을 삭제했어요.');
    } catch (error) {
      setDeleteError(
        error instanceof ApiError && (error.status === 0 || error.status >= 500)
          ? '삭제 여부를 확인하지 못했어요. 창을 닫고 목록 새로고침으로 결과를 확인해 주세요.'
          : error instanceof Error
            ? error.message
            : '삭제하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      deleting.current = false;
    }
  };
  const todos = useQuery({
    queryKey: ['todos', dateKey],
    queryFn: () => api.getTodos(dateKey),
    enabled: status === 'authenticated',
    retry: false,
  });
  const relatedDiary = useQuery({
    queryKey: ['diaryByDate', epoch, dateKey],
    enabled: status === 'authenticated' && managedTodo !== null,
    staleTime: 30000,
    retry: false,
    queryFn: async () => {
      try {
        return await createDiaryApi(client).getByDate(dateKey);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const linkedDiary =
    managedTodo &&
    relatedDiary.data?.todos?.some((todo) => todo.id === managedTodo.id)
      ? relatedDiary.data
      : null;
  useEffect(() => {
    if (!action || status !== 'authenticated') return;
    onActionHandled();
    if (action === 'add') setForm({ date: parseDiaryDate(dateKey)! });
    else void requestChild(() => setRecommendations(dateKey));
  }, [action, dateKey, onActionHandled, requestChild, status]);
  const addSchedule = () => {
    setAddMenu(false);
    setForm({ date: parseDiaryDate(dateKey)! });
  };
  const recommendActivities = () => {
    setAddMenu(false);
    void requestChild(() => setRecommendations(dateKey));
  };
  const openDiary = (todo: TodoResponse) => {
    router.push({
      pathname: '/diary',
      params: {
        date: todo.scheduledDate,
        mode: 'create',
        todoId: String(todo.id),
      },
    });
  };
  const visibleTasks = (todos.data ?? [])
    .map((todo) => ({
      todo,
      id: todo.id,
      title: todo.planName,
      description: todo.content ?? '',
      time: todo.scheduledTime.slice(0, 5),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <View>
      <View style={styles.scheduleList}>
        <CalendarSectionHeader
          title="일정"
          action={
            status === 'authenticated'
              ? {
                  label: '일정 추가',
                  onPress: () => setAddMenu((open) => !open),
                }
              : undefined
          }
        />
        {addMenu ? (
          <View style={styles.addChoices}>
            <Pressable
              accessibilityRole="button"
              style={styles.menuAction}
              onPress={addSchedule}
            >
              <Text style={styles.listActionLabel}>직접 추가</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.menuAction}
              onPress={recommendActivities}
            >
              <Text style={styles.listActionLabel}>AI 활동 추천</Text>
            </Pressable>
          </View>
        ) : null}
        {completionError ? (
          <Text accessibilityRole="alert" style={styles.listError}>
            {completionError}
          </Text>
        ) : null}
        <View style={styles.listSurface}>
          {isInitialLoading(todos) ? (
            <ScheduleSkeleton />
          ) : todos.isPending ? (
            <Text style={styles.listMessage}>
              일정 조회 연결을 기다리고 있어요.
            </Text>
          ) : null}
          {todos.isError ? (
            <View style={styles.listState}>
              <Text accessibilityRole="alert" style={styles.listError}>
                일정을 불러오지 못했어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.listAction}
                onPress={() => void todos.refetch()}
              >
                <Text style={styles.listActionLabel}>다시 시도</Text>
              </Pressable>
            </View>
          ) : todos.data !== undefined && visibleTasks.length === 0 ? (
            <Text style={styles.listMessage}>등록된 일정이 없어요.</Text>
          ) : null}
          {visibleTasks.map((task, index) => (
            <View
              key={task.id}
              style={[styles.taskRow, index > 0 && styles.taskDivider]}
            >
              <Text style={styles.time}>{task.time}</Text>
              <View style={styles.taskCopy}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${task.title} 메뉴`}
                  onPress={() => setManagedTodo(task.todo)}
                  style={({ pressed }) => [
                    styles.taskDetails,
                    pressed && styles.taskPressed,
                  ]}
                >
                  <View style={styles.taskText}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.description ? (
                      <Text style={styles.taskDescription}>
                        {task.description}
                      </Text>
                    ) : null}
                  </View>
                  <SymbolView
                    name="ellipsis"
                    size={16}
                    tintColor={colors.muted}
                    accessible={false}
                    fallback={
                      <Text accessible={false} style={styles.taskMore}>
                        ⋯
                      </Text>
                    }
                  />
                </Pressable>
                {task.todo.completed ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${task.title} 반응 ${task.todo.childReaction ? '수정' : '기록'}`}
                    disabled={completion.isPending}
                    accessibilityState={{ disabled: completion.isPending }}
                    onPress={() => setReactionTodo(task.todo)}
                    style={({ pressed }) => [
                      styles.taskReaction,
                      pressed && styles.taskPressed,
                    ]}
                  >
                    <Text style={styles.taskReactionLabel}>
                      {task.todo.childReaction
                        ? `${childReactionLabels[task.todo.childReaction]} · 수정`
                        : '반응 남기기'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={task.todo.completed}
                aria-busy={completion.isPending}
                accessibilityLabel={`${task.title} ${task.todo.completed ? '완료 취소' : '완료'}`}
                accessibilityState={{
                  checked: task.todo.completed,
                  disabled: completion.isPending,
                  busy: completion.isPending,
                }}
                disabled={completion.isPending}
                onPress={() => void toggleCompletion(task.todo)}
                style={styles.completionButton}
              >
                <ScheduleCheck completed={task.todo.completed} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>
      {notice ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.notice}
        >
          {notice}
        </Text>
      ) : null}
      {reactionTodo ? (
        <TodoReactionModal
          key={reactionTodo.id}
          todo={reactionTodo}
          onClose={() => setReactionTodo(null)}
          onDiary={() => {
            openDiary(reactionTodo);
            setReactionTodo(null);
          }}
          onMemo={() => {
            setForm({
              date: new Date(`${reactionTodo.scheduledDate}T00:00:00`),
              todo: reactionTodo,
            });
            setReactionTodo(null);
          }}
        />
      ) : null}
      {recommendations ? (
        <ScheduleGenerationModal
          date={recommendations}
          onClose={() => setRecommendations(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: ['todos', recommendations],
            });
            void queryClient.invalidateQueries({ queryKey: ['todoMonth'] });
          }}
        />
      ) : null}
      {managedTodo ? (
        <Modal transparent animationType="fade" onRequestClose={closeMenu}>
          <SafeAreaView style={styles.menuOverlay}>
            <ScrollView
              style={{
                maxHeight: '90%',
                width: '100%',
                maxWidth: 440,
                alignSelf: 'center',
              }}
              contentContainerStyle={styles.menuSheet}
              accessibilityViewIsModal
            >
              <Text accessibilityRole="header" style={styles.menuTitle}>
                {confirmDelete ? '계획을 삭제할까요?' : managedTodo.planName}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { marginTop: 12, color: colors.muted },
                ]}
              >
                {managedTodo.scheduledDate} ·{' '}
                {managedTodo.scheduledTime.slice(0, 5)} ·{' '}
                {managedTodo.completed ? '완료' : '예정'}
              </Text>
              {managedTodo.content ? (
                <Text style={styles.listMessage}>{managedTodo.content}</Text>
              ) : null}
              {managedTodo.childReaction ? (
                <Text style={styles.taskReactionLabel}>
                  기록한 반응: {childReactionLabels[managedTodo.childReaction]}
                </Text>
              ) : null}
              {deleteError ? (
                <Text accessibilityRole="alert" style={styles.notice}>
                  {deleteError}
                </Text>
              ) : null}
              {confirmDelete ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={remove.isPending}
                  accessibilityState={{
                    disabled: remove.isPending,
                    busy: remove.isPending,
                  }}
                  onPress={() => void deleteTodo()}
                  style={styles.menuAction}
                >
                  <Text>{remove.isPending ? '삭제 중…' : '삭제하기'}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setForm({
                        date: new Date(`${managedTodo.scheduledDate}T00:00:00`),
                        todo: managedTodo,
                      });
                      closeMenu();
                    }}
                    style={styles.menuAction}
                  >
                    <Text>수정</Text>
                  </Pressable>
                  {linkedDiary || managedTodo.completed ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        if (linkedDiary) {
                          router.push({
                            pathname: '/diary',
                            params: {
                              date: dateKey,
                              id: String(linkedDiary.id),
                              mode: 'view',
                            },
                          });
                        } else openDiary(managedTodo);
                        closeMenu();
                      }}
                      style={styles.menuAction}
                    >
                      <Text>
                        {linkedDiary
                          ? '연결된 일기 보기'
                          : '이 활동을 일기로 남기기'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmDelete(true)}
                    style={styles.menuAction}
                  >
                    <Text>삭제</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={remove.isPending}
                onPress={closeMenu}
                style={styles.menuAction}
              >
                <Text>취소</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
      {form ? (
        <AddPlanModal
          date={form.date}
          onClose={() => setForm(null)}
          initialValues={
            form.todo
              ? {
                  title: form.todo.planName,
                  time: form.todo.scheduledTime.slice(0, 5),
                  description: form.todo.content ?? '',
                  durationMinutes: form.todo.durationMinutes ?? undefined,
                }
              : undefined
          }
          onAdd={async (plan) => {
            const date = form.date;
            await save.mutateAsync({
              id: form.todo?.id,
              previousDate: form.todo?.scheduledDate,
              input: {
                planName: plan.title,
                content: plan.description,
                scheduledDate: form.todo?.scheduledDate ?? diaryDateKey(date),
                scheduledTime: `${plan.time}:00`,
                durationMinutes: plan.durationMinutes,
              },
            });
            setForm(null);
            setNotice(form.todo ? '계획을 수정했어요.' : '계획을 추가했어요.');
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  addChoices: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  menuTitle: { ...typography.section, fontSize: 20, color: colors.text },
  menuAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  scheduleList: { paddingHorizontal: 10, gap: spacing.sm },
  listAction: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
  },
  listActionLabel: { ...typography.label, color: colors.primary },
  listSurface: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listState: { padding: spacing.lg, gap: spacing.xs },
  listMessage: { ...typography.body, color: colors.muted, padding: spacing.lg },
  listError: { ...typography.label, color: colors.danger },
  taskRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  taskDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  time: {
    ...typography.label,
    minWidth: 48,
    paddingTop: 11,
    fontVariant: ['tabular-nums'],
    color: colors.muted,
  },
  taskCopy: { flex: 1, minWidth: 0 },
  taskDetails: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 10,
    gap: spacing.sm,
    borderRadius: 10,
  },
  taskText: { flex: 1, minWidth: 0, gap: spacing.xs },
  taskTitle: { ...typography.button, color: colors.heading },
  taskDescription: { ...typography.label, color: colors.muted },
  taskMore: { ...typography.button, color: colors.muted },
  taskPressed: { backgroundColor: colors.background },
  taskReaction: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
  },
  taskReactionLabel: { ...typography.caption, color: colors.onTint },
  completionButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    margin: 18,
    textAlign: 'center',
    ...typography.caption,
    color: colors.primary,
  },
});
