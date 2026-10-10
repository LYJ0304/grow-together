import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Alert,
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

const tasks = [
  {
    time: '07:00',
    icon: '◷',
    title: '기상 & 기저귀 갈기',
    description: '아이가 깨어요\n기저귀를 갈아주세요.',
    tag: '# 기본적인 시작 루틴',
    period: 'past',
  },
  {
    time: '07:30',
    icon: '♨',
    title: '아침 이유식',
    description: '아침 식사 시간이에요. 새로운\n재료는 하루 한 번만 시도해요.',
    tag: '# 식습관 안정화',
    period: 'past',
  },
  {
    time: '09:00',
    icon: '♧',
    title: '놀이 & 탐색',
    description: '탐색 놀이 시간이에요.\n블록놀이 추천해요!',
    tag: '# 발달 자극',
    period: 'past',
  },
  {
    time: '10:00',
    icon: 'z',
    title: '낮잠 (1~1.5시간)',
    description: '편안한 환경에서 충분히\n휴식할 수 있도록 도와주세요.',
    tag: '# 충분한 휴식',
    period: 'past',
  },
  {
    time: '12:00',
    icon: '♨',
    title: '점심 이유식',
    description: '점심 시간이 왔어요.\n새로운 식감 시도도 좋아요.',
    tag: '# 성장/영양',
    period: 'past',
  },
  {
    time: '12:30',
    icon: '♧',
    title: '산책/외부 활동',
    description: '햇빛을 쬐면 비타민D\n합성에 좋아요.',
    tag: '# 발달 자극',
    period: 'past',
  },
  {
    time: '14:00',
    icon: '▤',
    title: '책 읽기 & 놀이',
    description: '짧은 그림책을 같이 읽어 주세요\n언어 발달에 좋아요.',
    tag: '# 언어 발달',
    period: 'past',
  },
  {
    time: '15:00',
    icon: 'z',
    title: '낮잠 (1시간)',
    description: '점심 시간이 왔어요.\n새로운 식감 시도도 좋아요.',
    tag: '# 피로회복',
    period: 'current',
  },
  {
    time: '17:30',
    icon: '♧',
    title: '산책/외부활동',
    description: '밤잠 잘 잘 수 있도록\n산책을 해요.',
    tag: '# 발달 자극',
    period: 'future',
  },
  {
    time: '18:00',
    icon: '♨',
    title: '저녁 이유식',
    description: '저녁 식사 시간이에요. 단백질 식품\n을 포함해보세요.',
    tag: '# 성장/영양',
    period: 'future',
  },
  {
    time: '18:30',
    icon: '♧',
    title: '목욕 & 양치놀이',
    description: '저녁 활동을 마무리하며\n목욕해 주세요.',
    tag: '# 면역/위생 습관',
    period: 'future',
  },
  {
    time: '19:30',
    icon: '▤',
    title: '책 읽기 & 차분한 놀이',
    description: '짧은 그림책을 읽어주며\n차분히 마무리해요.',
    tag: '# 언어 발달  # 정서 안정',
    period: 'future',
  },
  {
    time: '20:00',
    icon: '▱',
    title: '취침 준비',
    description: '잠자기 전 차분한 분위기를\n만들어주세요.',
    tag: '# 수면유도',
    period: 'future',
  },
  {
    time: '21:00',
    icon: 'z',
    title: '취침',
    description: '오늘 하루가 끝났어요.\n아기를 재워주세요.',
    tag: '# 마무리',
    period: 'future',
  },
] as const;

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

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
  const [addingPlan, setAddingPlan] = useState(false);
  // shortcut: plans live in screen state for this UI; add persistence when plan storage is requested.
  const [addedPlans, setAddedPlans] = useState<
    {
      id: number;
      date: number;
      title: string;
      time: string;
      description: string;
      icon: string;
      tag: string;
      period: 'future';
    }[]
  >([]);
  const nextPlanId = useRef(0);
  const week = getWeek(selectedDate);
  const visibleTasks = [
    ...tasks.map((task) => ({ ...task, id: task.time })),
    ...addedPlans.filter((plan) => plan.date === selectedDate.getTime()),
  ].sort((a, b) => a.time.localeCompare(b.time));

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
              onPress={() => {
                setNotice('');
                setAddingPlan(true);
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
                  onPress={() =>
                    setNotice(`${task.title} 상세 화면은 준비 중입니다.`)
                  }
                  style={({ pressed }) => [
                    styles.taskCard,
                    styles[task.period],
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.taskIcon}>
                    <Text
                      style={[
                        styles.taskIconText,
                        styles[`${task.period}Text`],
                      ]}
                    >
                      {task.icon}
                    </Text>
                  </View>
                  <View style={styles.taskCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.taskTitle, styles[`${task.period}Text`]]}
                    >
                      {task.title}
                    </Text>
                    <Text
                      style={[
                        styles.taskDescription,
                        styles[`${task.period}Text`],
                      ]}
                    >
                      {task.description}
                    </Text>
                    <Text
                      style={[styles.taskTag, styles[`${task.period}Text`]]}
                    >
                      {task.tag}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${task.title} 메뉴`}
                    onPress={() =>
                      setNotice(`${task.title} 메뉴는 준비 중입니다.`)
                    }
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
      {addingPlan ? (
        <AddPlanModal
          date={selectedDate}
          onClose={() => setAddingPlan(false)}
          onAdd={(plan) => {
            const id = nextPlanId.current++;
            setAddedPlans((current) => [
              ...current,
              {
                ...plan,
                id,
                date: selectedDate.getTime(),
                icon: '▤',
                tag: '# 나의 계획',
                period: 'future',
              },
            ]);
            setAddingPlan(false);
            setNotice('계획을 추가했어요.');
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  past: { backgroundColor: '#FDEDE6', opacity: 0.58 },
  current: { backgroundColor: '#FDEDE6' },
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
  taskTag: {
    marginTop: 2,
    fontFamily: 'Jua',
    fontSize: 10,
    lineHeight: 13,
    color: '#88889D',
  },
  pastText: { color: '#D26A5C' },
  currentText: { color: '#D26A5C' },
  futureText: { color: '#88889D' },
  more: { marginTop: -3, color: '#88889D', fontSize: 19, lineHeight: 20 },
  notice: {
    margin: 18,
    textAlign: 'center',
    fontFamily: 'Jua',
    fontSize: 13,
    color: '#D26A5C',
  },
  pressed: { opacity: 0.75 },
});
