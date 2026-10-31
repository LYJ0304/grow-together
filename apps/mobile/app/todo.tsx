import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Alert,
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

import { BottomNavigation } from '../src/components/bottom-navigation';
import { AddPlanModal } from '../src/components/add-plan-modal';
import { useAuth } from '../src/components/auth-provider';
import { ApiError } from '../src/lib/api/errors';
import { createTodoApi } from '../src/lib/features/todo/todoApi';
import type { TodoRequest, TodoResponse } from '../src/lib/features/todo/types';

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
  const scroll = useRef<ScrollView>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [view, setView] = useState<'시간' | '할 일'>('시간');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{ date: Date; todo?: TodoResponse } | null>(
    null,
  );
  const [managedTodo, setManagedTodo] = useState<TodoResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleting = useRef(false);
  const { client, status } = useAuth();
  const api = createTodoApi(client);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: TodoRequest }) => {
      if (id === undefined) await api.createTodo(input);
      else await api.updateTodo(id, input);
    },
    retry: false,
    onSuccess: (_result, { input }) => {
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
              <Text style={styles.addLabel}>＋ 계획 추가</Text>
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
            {visibleTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                {view === '시간' ? (
                  <Text style={styles.time}>{task.time}</Text>
                ) : (
                  <View style={styles.timeSpacer} />
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${task.time} ${task.title}`}
                  onPress={() => setManagedTodo(task.todo)}
                  style={({ pressed }) => [
                    styles.taskCard,
                    styles.future,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.taskIcon}>
                    <Text style={[styles.taskIconText, styles.futureText]}>
                      ▤
                    </Text>
                  </View>
                  <View style={styles.taskCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.taskTitle, styles.futureText]}
                    >
                      {task.title}
                    </Text>
                    <Text style={[styles.taskDescription, styles.futureText]}>
                      {task.description}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${task.title} 메뉴`}
                    onPress={(event) => {
                      event.stopPropagation();
                      setManagedTodo(task.todo);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.more}>⋮</Text>
                  </Pressable>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI로 일정 생성하기"
          onPress={() =>
            Alert.alert(
              'AI로 일정 생성하기',
              'AI 일정 생성 기능은 준비 중입니다.',
            )
          }
          style={({ pressed }) => [
            styles.aiScheduleButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.aiScheduleLabel}>AI로 일정 생성하기</Text>
        </Pressable>
      </View>

      <BottomNavigation
        active="투두"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onUnavailable={(label) => setNotice(`${label} 화면은 준비 중입니다.`)}
      />
      {managedTodo ? (
        <Modal transparent animationType="fade" onRequestClose={closeMenu}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuSheet} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={styles.menuTitle}>
                {confirmDelete ? '계획을 삭제할까요?' : managedTodo.planName}
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
            </View>
          </View>
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
                }
              : undefined
          }
          onAdd={async (plan) => {
            const date = form.date;
            await save.mutateAsync({
              id: form.todo?.id,
              input: {
                planName: plan.title,
                content: plan.description,
                scheduledDate: form.todo?.scheduledDate ?? localDateKey(date),
                scheduledTime: `${plan.time}:00`,
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  menuSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  menuTitle: { fontFamily: 'Jua', fontSize: 20, color: '#4F4F4F' },
  menuAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scheduleContent: { flex: 1 },
  content: { paddingBottom: 88 },
  aiScheduleButton: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#D26A5C',
    boxShadow: '0px 4px 12px rgba(84, 87, 92, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiScheduleLabel: { fontFamily: 'Jua', fontSize: 16, color: '#FFFFFF' },
  dateHeader: {
    minHeight: 96,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dateSummary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateNumber: {
    fontFamily: 'Jua',
    fontSize: 39,
    lineHeight: 46,
    color: '#4F4F4F',
  },
  dateMeta: {
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 15,
    color: '#BCC1CD',
  },
  addButton: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#FDEDE6',
  },
  addLabel: { fontFamily: 'Jua', fontSize: 16, color: '#D26A5C' },
  scheduleToolbar: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 8px rgba(84, 87, 92, 0.12)',
    zIndex: 1,
  },
  weekStrip: {
    height: 74,
    paddingHorizontal: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    width: 38,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  weekday: {
    fontFamily: 'Jua',
    fontSize: 10,
    lineHeight: 14,
    color: '#BCC1CD',
  },
  dayNumber: {
    marginTop: 3,
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 18,
    color: '#4F4F4F',
  },
  selectedDay: { backgroundColor: '#D26A5C' },
  selectedDayText: { color: '#FFFFFF' },
  viewTabs: {
    height: 54,
    paddingHorizontal: 27,
    borderTopWidth: 1,
    borderTopColor: '#F6F6F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabLabels: { flexDirection: 'row', gap: 28 },
  tabButton: { minWidth: 34, paddingVertical: 10 },
  tabLabel: { fontFamily: 'Jua', fontSize: 14, color: '#BCC1CD' },
  activeTabLabel: { color: '#88889D' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 17 },
  filterIcon: { fontSize: 18, color: '#88889D' },
  sortIcon: { fontSize: 21, color: '#BCC1CD' },
  timeline: {
    paddingTop: 18,
    paddingHorizontal: 22,
    borderLeftWidth: 1,
    borderLeftColor: '#FAF9F9',
    marginLeft: 82,
  },
  taskRow: {
    minHeight: 121,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: -60,
    gap: 13,
  },
  time: {
    width: 47,
    paddingTop: 17,
    textAlign: 'center',
    fontFamily: 'Jua',
    fontSize: 14,
    color: '#4E3A30',
  },
  timeSpacer: { width: 47 },
  taskCard: {
    flex: 1,
    minHeight: 104,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  future: { backgroundColor: '#F6F6F5' },
  taskIcon: { width: 20, alignItems: 'center' },
  taskIconText: { fontSize: 19, color: '#D26A5C' },
  taskCopy: { flex: 1, gap: 5 },
  taskTitle: {
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 19,
    color: '#D26A5C',
  },
  taskDescription: {
    fontFamily: 'Jua',
    fontSize: 11,
    lineHeight: 14,
    color: '#88889D',
  },
  futureText: { color: '#88889D' },
  more: { marginTop: -3, color: '#88889D', fontSize: 19, lineHeight: 20 },
  notice: {
    margin: 18,
    textAlign: 'center',
    fontFamily: 'Jua',
    fontSize: 13,
    color: '#D26A5C',
  },
  listAction: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
