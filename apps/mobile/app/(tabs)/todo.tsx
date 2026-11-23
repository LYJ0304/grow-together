import { spacing } from '../../src/theme/spacing';
import { getWeek } from '../../src/lib/calendar';
import {
  TodoReactionModal,
  childReactionLabels,
} from '../../src/components/todo-reaction-modal';
import { useChildRegistration } from '../../src/components/child-registration';
import { ScheduleCheck } from '../../src/components/schedule-check';
import { colors } from '../../src/theme/colors';
import { successFeedback } from '../../src/lib/haptics';
import { useTabScrollToTop } from '../../src/lib/use-tab-scroll-to-top';
import { router, useLocalSearchParams } from 'expo-router';
import { ScheduleGenerationModal } from '../../src/components/schedule-generation-modal';
import { SymbolView } from 'expo-symbols';
import { ScheduleAddMenu } from '../../src/components/schedule-add-menu';
import { typography } from '../../src/components/typography';
import { useSessionValue } from '../../src/lib/session-state';
import { PageIntro } from '../../src/components/page-intro';
import { AppHeader } from '../../src/components/app-header';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { parseDiaryDate } from '../../src/lib/diary-storage';
import {
  BackHandler,
  type LayoutRectangle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';

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

export default function TodoScreen() {
  const requestChild = useChildRegistration();
  const { client, status, epoch } = useAuth();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useTabScrollToTop(scroll);
  const [selectedDate, setSelectedDate] = useSessionValue('todoDate', () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const params = useLocalSearchParams<{
    date?: string;
    add?: string;
    recommend?: string;
  }>();
  const [reactionTodo, setReactionTodo] = useState<TodoResponse | null>(null);
  useEffect(() => {
    setReactionTodo(null);
  }, [epoch]);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  useEffect(() => {
    const fromRoute = parseDiaryDate(params.date);
    if (fromRoute)
      setSelectedDate((current) =>
        localDateKey(current) === params.date ? current : fromRoute,
      );
    if (params.add === 'true' && status === 'authenticated')
      setForm({ date: fromRoute ?? selectedDate });
    if (params.recommend === 'true' && status === 'authenticated')
      void requestChild(() =>
        setRecommendations(params.date || localDateKey(selectedDate)),
      );
    if (params.date || params.add || params.recommend)
      router.setParams({ date: '', add: '', recommend: '' });
  }, [
    params.date,
    params.add,
    params.recommend,
    status,
    selectedDate,
    setSelectedDate,
    requestChild,
  ]);
  const contentLayout = useRef<LayoutRectangle | null>(null);
  const dateLayout = useRef<LayoutRectangle | null>(null);
  const buttonLayout = useRef<LayoutRectangle | null>(null);
  const scrollOffset = useRef(0);
  const addButton = useRef<ComponentRef<typeof View>>(null);
  const [addMenu, setAddMenu] = useState<{
    right: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const openAddMenu = () => {
    if (addMenu) {
      setAddMenu(null);
      return;
    }
    const content = contentLayout.current;
    const date = dateLayout.current;
    const button = buttonLayout.current;
    if (!content || !date || !button) return;
    const anchorTop = date.y + button.y - scrollOffset.current;
    const below = anchorTop + button.height + spacing.sm;
    setAddMenu({
      width: Math.min(232, content.width - spacing.lg * 2),
      right: Math.max(spacing.lg, content.width - button.x - button.width),
      ...(content.height - below >= 128
        ? { top: below }
        : { bottom: content.height - anchorTop + spacing.sm }),
    });
  };
  useEffect(() => {
    if (!addMenu) return;
    if (Platform.OS === 'web') {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setAddMenu(null);
        addButton.current?.focus();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setAddMenu(null);
      return true;
    });
    return () => back.remove();
  }, [addMenu]);
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

  const addSchedule = () => {
    setAddMenu(null);
    setNotice('');
    setForm({ date: selectedDate });
  };
  const recommendActivities = () => {
    setAddMenu(null);
    void requestChild(() => setRecommendations(dateKey));
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader />
      <View
        onLayout={(event) => {
          contentLayout.current = event.nativeEvent.layout;
        }}
        style={styles.scheduleContent}
      >
        <ScrollView
          ref={scroll}
          stickyHeaderIndices={[2]}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={styles.content}
        >
          <View style={{ paddingHorizontal: 22, paddingTop: spacing.sm }}>
            <PageIntro
              eyebrow="PLAN THE DAY"
              title="함께할 시간"
              description="부담 없는 하루 계획을 만들고, 하나씩 실행해요."
            />
          </View>
          <View
            style={styles.dateHeader}
            onLayout={(event) => {
              dateLayout.current = event.nativeEvent.layout;
            }}
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
            <ScheduleAddMenu
              canAdd={status === 'authenticated'}
              onAdd={addSchedule}
              onRecommend={recommendActivities}
              fallback={
                <Pressable
                  ref={addButton}
                  onLayout={(event) => {
                    buttonLayout.current = event.nativeEvent.layout;
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="일정 추가 메뉴"
                  aria-expanded={Boolean(addMenu)}
                  accessibilityState={{ expanded: Boolean(addMenu) }}
                  onPress={openAddMenu}
                  style={({ pressed }) => [
                    styles.addToggle,
                    (pressed || addMenu) && styles.addToggleActive,
                  ]}
                >
                  <SymbolView
                    name="plus"
                    size={20}
                    weight="semibold"
                    tintColor={colors.onTint}
                    accessible={false}
                    fallback={
                      <Text accessible={false} style={styles.addSymbol}>
                        +
                      </Text>
                    }
                  />
                </Pressable>
              }
            />
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
                      setAddMenu(null);
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
          </View>

          <View style={styles.scheduleList}>
            <View style={styles.listHeader}>
              <Text accessibilityRole="header" style={styles.listTitle}>
                일정
              </Text>
              {status === 'authenticated' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="목록 새로고침"
                  style={({ pressed }) => [
                    styles.listAction,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => void todos.refetch()}
                >
                  <Text style={styles.listActionLabel}>새로고침</Text>
                </Pressable>
              ) : null}
            </View>
            {completionError ? (
              <Text accessibilityRole="alert" style={styles.listError}>
                {completionError}
              </Text>
            ) : null}
            <View style={styles.listSurface}>
              {status === 'preview' ? (
                <Text style={styles.listMessage}>
                  미리보기에서는 서버 일정을 이용할 수 없어요.
                </Text>
              ) : todos.isPending ? (
                <Text style={styles.listMessage}>일정을 불러오고 있어요.</Text>
              ) : todos.isError ? (
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
              ) : visibleTasks.length === 0 ? (
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
        </ScrollView>
        {addMenu ? (
          <View
            style={styles.addMenuLayer}
            accessibilityViewIsModal
            onAccessibilityEscape={() => setAddMenu(null)}
          >
            <Pressable
              accessible={false}
              style={StyleSheet.absoluteFill}
              onPress={() => setAddMenu(null)}
            />
            <View style={[styles.addMenu, addMenu]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="직접 추가"
                disabled={status !== 'authenticated'}
                accessibilityState={{ disabled: status !== 'authenticated' }}
                onPress={addSchedule}
                style={({ pressed }) => [
                  styles.addMenuItem,
                  pressed && styles.addMenuItemPressed,
                ]}
              >
                <Text
                  style={[
                    styles.addMenuLabel,
                    status !== 'authenticated' && styles.addMenuDisabled,
                  ]}
                >
                  직접 추가
                </Text>
                <SymbolView
                  name="calendar.badge.plus"
                  size={18}
                  tintColor={
                    status !== 'authenticated' ? colors.muted : colors.onTint
                  }
                  accessible={false}
                  fallback={
                    <Text accessible={false} style={styles.addMenuSymbol}>
                      +
                    </Text>
                  }
                />
              </Pressable>
              <View style={styles.addMenuDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="AI 활동 추천"
                onPress={recommendActivities}
                style={({ pressed }) => [
                  styles.addMenuItem,
                  pressed && styles.addMenuItemPressed,
                ]}
              >
                <Text style={styles.addMenuLabel}>AI 활동 추천</Text>
                <SymbolView
                  name="sparkles"
                  size={18}
                  tintColor={colors.onTint}
                  accessible={false}
                  fallback={
                    <Text accessible={false} style={styles.addMenuSymbol}>
                      ✦
                    </Text>
                  }
                />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {reactionTodo ? (
        <TodoReactionModal
          key={reactionTodo.id}
          todo={reactionTodo}
          onClose={() => setReactionTodo(null)}
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
  scheduleContent: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  content: { paddingBottom: 32 },
  dateHeader: {
    paddingTop: spacing.lg,
    minHeight: 64,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  dateSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateNumber: {
    ...typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 26,
    lineHeight: 36,
    color: colors.text,
  },
  dateMeta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
  },
  addToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  addToggleActive: { backgroundColor: colors.secondaryPressed },
  addSymbol: { fontSize: 24, color: colors.onTint },
  addMenuLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  addMenu: {
    position: 'absolute',
    borderRadius: 20,
    padding: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: '0px 8px 26px rgba(41, 41, 41, 0.15)',
    elevation: 8,
  },
  addMenuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
  },
  addMenuItemPressed: { backgroundColor: colors.tint },
  addMenuLabel: {
    ...typography.label,
    flexShrink: 1,
    fontWeight: '600',
    color: colors.heading,
  },
  addMenuDisabled: { color: colors.muted },
  addMenuSymbol: { ...typography.button, color: colors.onTint },
  addMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  scheduleToolbar: {
    backgroundColor: colors.background,
    zIndex: 1,
  },
  weekStrip: {
    minHeight: 80,
    paddingHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    flex: 1,
    minWidth: 44,
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
  scheduleList: { paddingHorizontal: 24, gap: spacing.sm },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.sm,
  },
  listTitle: { ...typography.section, color: colors.heading },
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
  pressed: { backgroundColor: colors.surface },
});
