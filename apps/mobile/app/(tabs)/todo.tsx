import { ScheduleCheck } from '../../src/components/schedule-check';
import { colors } from '../../src/theme/colors';
import { successFeedback } from '../../src/lib/haptics';
import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { router, useLocalSearchParams } from 'expo-router';
import { ScheduleGenerationModal } from '../../src/components/schedule-generation-modal';
import { ActionButton } from '../../src/components/action-button';
import { typography } from '../../src/components/typography';
import { useSessionValue } from '../../src/lib/session-state';
import { AppHeader } from '../../src/components/app-header';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { parseDiaryDate } from '../../src/lib/diary-storage';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AddPlanModal } from '../../src/components/add-plan-modal';
import { useAuth } from '../../src/components/auth-provider';
import { ApiError } from '../../src/lib/api/errors';
import { createTodoApi } from '../../src/lib/features/todo/todoApi';
import type {
  TodoRequest,
  TodoResponse,
} from '../../src/lib/features/todo/types';

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function TodoScreen() {
  const insets = useSafeAreaInsets();
  const { client, status } = useAuth();
  const scroll = useRef<ScrollView>(null);
  useTabScrollToTop(scroll);
  const [selectedDate, setSelectedDate] = useSessionValue('todoDate', () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const params = useLocalSearchParams<{ date?: string; add?: string }>();
  const [reactionTodo, setReactionTodo] = useState<TodoResponse | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  useEffect(() => {
    const fromRoute = parseDiaryDate(params.date);
    if (fromRoute)
      setSelectedDate((current) =>
        localDateKey(current) === params.date ? current : fromRoute,
      );
    if (params.add === 'true' && status === 'authenticated')
      setForm({ date: fromRoute ?? selectedDate });
    if (params.date || params.add) router.setParams({ date: '', add: '' });
  }, [params.date, params.add, status, selectedDate, setSelectedDate]);
  const [view, setView] = useState<'시간' | '할 일'>('시간');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{ date: Date; todo?: TodoResponse } | null>(
    null,
  );
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
  const dateKey = localDateKey(selectedDate);
  const todos = useQuery({
    queryKey: ['todos', dateKey],
    queryFn: () => api.getTodos(dateKey),
    enabled: status === 'authenticated',
    retry: false,
  });
  const week = getWeek(selectedDate);
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader />
      <View style={styles.scheduleContent}>
        <ScrollView
          ref={scroll}
          stickyHeaderIndices={[1]}
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.dateHeader,
              { paddingTop: Math.max(18, 25 - insets.top) },
            ]}
          >
            <View style={styles.dateSummary}>
              <Text accessibilityRole="header" style={styles.dateNumber}>
                {selectedDate.getDate()}
              </Text>
              <View>
                <Text style={styles.dateMeta}>
                  {weekDays[selectedDate.getDay()]}요일
                </Text>
                <Text style={styles.dateMeta}>
                  {selectedDate.getMonth() + 1}월 {selectedDate.getFullYear()}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={status !== 'authenticated'}
              onPress={() => {
                setNotice('');
                setForm({ date: selectedDate });
              }}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.addLabel}>＋ 직접 추가</Text>
            </Pressable>
          </View>

          <View style={styles.scheduleToolbar}>
            <View style={styles.weekStrip}>
              {week.map((date) => {
                const selected = date.getTime() === selectedDate.getTime();
                return (
                  <Pressable
                    key={date.toISOString()}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일 ${weekDays[date.getDay()]}요일`}
                    aria-pressed={selected}
                    onPress={() => {
                      setSelectedDate(date);
                      setNotice('');
                    }}
                    style={({ pressed }) => [
                      styles.weekDay,
                      selected && styles.selectedDay,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekday,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {weekDays[date.getDay()]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        selected && styles.selectedDayText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.viewTabs}>
              <View style={styles.tabLabels}>
                {(['시간', '할 일'] as const).map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="tab"
                    aria-selected={view === label}
                    onPress={() => setView(label)}
                    style={styles.tabButton}
                  >
                    <Text
                      style={[
                        styles.tabLabel,
                        view === label && styles.activeTabLabel,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.filters}>
                <Text style={styles.filterIcon}>✧♙</Text>
                <Text style={styles.filterIcon}>♕</Text>
                <Text style={styles.sortIcon}>☷</Text>
              </View>
            </View>
          </View>

          <View style={{ margin: 18 }}>
            <ActionButton
              label="활동 추천받기"
              secondary
              onPress={() => setRecommendations(localDateKey(selectedDate))}
            />
          </View>
          <View style={styles.timeline}>
            {status === 'preview' ? (
              <Text>미리보기에서는 서버 일정을 이용할 수 없어요.</Text>
            ) : (
              <>
                {todos.isPending ? <Text>일정을 불러오고 있어요.</Text> : null}
                {todos.isError ? (
                  <>
                    <Text accessibilityRole="alert">
                      일정을 불러오지 못했어요.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.listAction}
                      onPress={() => void todos.refetch()}
                    >
                      <Text>다시 시도</Text>
                    </Pressable>
                  </>
                ) : null}
                {!todos.isPending &&
                !todos.isError &&
                visibleTasks.length === 0 ? (
                  <Text>등록된 일정이 없어요.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  style={styles.listAction}
                  onPress={() => void todos.refetch()}
                >
                  <Text>목록 새로고침</Text>
                </Pressable>
              </>
            )}
            {completionError ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {completionError}
              </Text>
            ) : null}
            {visibleTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                {view === '시간' ? (
                  <Text style={styles.time}>{task.time}</Text>
                ) : (
                  <View style={styles.timeSpacer} />
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${task.title} 메뉴`}
                  onPress={() => setManagedTodo(task.todo)}
                  style={({ pressed }) => [
                    styles.taskCard,
                    styles.future,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.taskCopy}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.description ? (
                      <Text style={styles.taskDescription}>
                        {task.description}
                      </Text>
                    ) : null}
                    <Text style={[typography.caption, { color: colors.muted }]}>
                      {task.todo.completed ? '완료' : '예정'}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.primary }]}
                    >
                      수정 · 삭제
                    </Text>
                  </View>
                </Pressable>
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
          {notice ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {notice}
            </Text>
          ) : null}
        </ScrollView>
      </View>

      {reactionTodo ? (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setReactionTodo(null)}
        >
          <SafeAreaView
            style={[styles.menuOverlay, { justifyContent: 'flex-end' }]}
          >
            <ScrollView
              style={{
                maxHeight: '90%',
                width: '100%',
                maxWidth: 440,
                alignSelf: 'center',
              }}
              contentContainerStyle={[styles.menuSheet, { gap: 14 }]}
              accessibilityViewIsModal
            >
              <Text accessibilityRole="header" style={styles.menuTitle}>
                아이의 반응은 어땠나요?
              </Text>
              <Text style={typography.body}>
                완료는 저장됐어요. 반응 선택과 사진 저장은 아직 연결 준비
                중이에요.
              </Text>
              <Text style={typography.body}>
                좋아했어요 · 보통이에요 · 어려워했어요
              </Text>
              <Text style={typography.caption}>
                지금은 기존 일정 메모에 관찰한 내용을 남길 수 있어요. 보호자의
                감정과 아이의 반응은 구분해 적어주세요.
              </Text>
              <ActionButton
                label="일정 메모에 한 줄 남기기"
                secondary
                onPress={() => {
                  setForm({
                    date: new Date(`${reactionTodo.scheduledDate}T00:00:00`),
                    todo: reactionTodo,
                  });
                  setReactionTodo(null);
                }}
              />
              <ActionButton
                label="반응 안내 닫기"
                onPress={() => setReactionTodo(null)}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
      {recommendations ? (
        <ScheduleGenerationModal
          date={recommendations}
          onClose={() => setRecommendations(null)}
          onSaved={() =>
            void queryClient.invalidateQueries({
              queryKey: ['todos', recommendations],
            })
          }
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
                예정·완료로 관리해요. 미룸·건너뜀 상태는 아직 지원하지 않아요.
                시간을 바꾸려면 수정을 눌러주세요.
              </Text>
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
                scheduledDate: form.todo?.scheduledDate ?? localDateKey(date),
                scheduledTime: `${plan.time}:00`,
                durationMinutes: plan.durationMinutes,
              },
            });
            setForm(null);
            setNotice(form.todo ? '계획을 수정했어요.' : '계획을 추가했어요.');
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  container: { flex: 1, backgroundColor: colors.background },
  scheduleContent: { flex: 1 },
  content: { paddingBottom: 32 },
  dateHeader: {
    minHeight: 96,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  dateSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateNumber: {
    ...typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 36,
    lineHeight: 46,
    color: colors.text,
  },
  dateMeta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  addButton: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: colors.tint,
  },
  addLabel: { ...typography.button, fontSize: 16, color: colors.onTint },
  scheduleToolbar: {
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  weekStrip: {
    minHeight: 80,
    paddingHorizontal: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    flex: 1,
    minWidth: 38,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  weekday: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  dayNumber: {
    marginTop: 3,
    ...typography.label,
    lineHeight: 18,
    color: colors.text,
  },
  selectedDay: { backgroundColor: colors.primary },
  selectedDayText: { color: colors.surface },
  viewTabs: {
    minHeight: 56,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabLabels: { flexDirection: 'row', gap: 20 },
  tabButton: { minWidth: 34, paddingVertical: 10 },
  tabLabel: { ...typography.label, fontSize: 14, color: colors.muted },
  activeTabLabel: { color: colors.primary, fontWeight: '700' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 17 },
  filterIcon: { fontSize: 18, color: colors.muted },
  sortIcon: { fontSize: 21, color: colors.muted },
  timeline: {
    paddingTop: 18,
    paddingHorizontal: 22,
    borderLeftWidth: 1,
    borderLeftColor: colors.background,
    marginLeft: 82,
  },
  completionButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    minHeight: 112,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: -60,
    gap: 13,
  },
  time: {
    width: 47,
    paddingTop: 17,
    textAlign: 'center',
    ...typography.label,
    color: colors.text,
  },
  timeSpacer: { width: 47 },
  taskCard: {
    flex: 1,
    backgroundColor: colors.surface,
    minHeight: 96,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  future: { backgroundColor: colors.surface },
  taskCopy: { flex: 1, minWidth: 0, gap: 5 },
  taskTitle: { ...typography.button, color: colors.text },
  taskDescription: { ...typography.label, color: colors.muted },
  notice: {
    margin: 18,
    textAlign: 'center',
    ...typography.caption,
    color: colors.primary,
  },
  listAction: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
