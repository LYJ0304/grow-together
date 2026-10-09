import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Platform,
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

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [initialDate] = useState(() => new Date());
  const [month, setMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [selected, setSelected] = useState(initialDate);
  const [notice, setNotice] = useState('');
  const firstWeekday = month.getDay();
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1),
  );

  const changeMonth = (offset: number) => {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
    setNotice('');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(14, 88 - insets.top) },
        ]}
      >
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            onPress={() => changeMonth(-1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../assets/images/calendar/previous.svg')}
              style={styles.arrow}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
          <View style={styles.monthTitle}>
            <Text accessibilityRole="header" style={styles.month}>
              {month.getMonth() + 1}월
            </Text>
            <Text style={styles.year}>{month.getFullYear()}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            onPress={() => changeMonth(1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
            ]}
          >
            <Image
              source={require('../assets/images/calendar/next.svg')}
              style={[styles.arrow, styles.nextArrow]}
              contentFit="contain"
              accessible={false}
            />
          </Pressable>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekdays}>
            {['일', '월', '화', '수', '목', '금', '토'].map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.weekday,
                  (index === 0 || index === 6) && styles.weekend,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.weeks}>
            {Array.from({ length: 6 }, (_, week) => (
              <View key={week} style={styles.week}>
                {days.slice(week * 7, week * 7 + 7).map((date) => {
                  const isSelected = date.getTime() === selected.getTime();
                  const outsideMonth = date.getMonth() !== month.getMonth();
                  return (
                    <Pressable
                      key={date.getTime()}
                      accessibilityRole="button"
                      accessibilityLabel={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`}
                      aria-pressed={isSelected}
                      onPress={() => {
                        setSelected(date);
                        if (outsideMonth)
                          setMonth(
                            new Date(date.getFullYear(), date.getMonth(), 1),
                          );
                        setNotice('');
                      }}
                      style={({ pressed }) => [
                        styles.day,
                        isSelected && styles.selectedDay,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          outsideMonth && styles.outsideDay,
                          isSelected && styles.selectedDayText,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {notice ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.notice}
          >
            {notice}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setNotice('선택한 날짜의 일기 생성 화면은 준비 중입니다.')
          }
          style={({ pressed }) => [
            styles.generateButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.generateLabel}>
            일기 생성하기 <Text style={styles.emoji}>✨</Text>
          </Text>
        </Pressable>
      </View>
      <BottomNavigation
        active="캘린더"
        onReselect={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onUnavailable={(label) => setNotice(`${label} 화면은 준비 중입니다.`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 24,
    alignItems: 'center',
  },
  monthHeader: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 334,
    alignItems: 'flex-start',
  },
  monthButton: {
    width: 44,
    height: 44,
    marginTop: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { width: 6.36856, height: 14.3687 },
  nextArrow: { transform: [{ scaleX: -1 }] },
  monthTitle: { flex: 1, alignItems: 'center' },
  month: {
    fontFamily: 'Jua',
    fontSize: 31.434,
    lineHeight: 38,
    color: '#4F4F4F',
  },
  year: {
    marginTop: -3,
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 14,
    color: '#4F4F4F',
  },
  calendar: { width: '100%', maxWidth: 360 },
  weekdays: { flexDirection: 'row', marginTop: 18, gap: 15 },
  weekday: {
    flex: 1,
    fontFamily: 'Jua',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    color: '#4F4F4F',
  },
  weekend: { color: '#D26A5C' },
  weeks: { marginTop: 8, gap: 7 },
  week: { flexDirection: 'row', gap: 15 },
  day: {
    flex: 1,
    height: 39.292,
    borderRadius: 7.858,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontFamily: 'Jua',
    fontSize: 12,
    lineHeight: 16,
    color: '#4F4F4F',
  },
  outsideDay: { color: '#D5D7E0' },
  selectedDay: { backgroundColor: '#D26A5C' },
  selectedDayText: { color: '#FFFFFF' },
  actions: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 16,
    paddingBottom: 12,
  },
  generateButton: {
    width: '100%',
    maxWidth: 239,
    minHeight: 51,
    borderRadius: 14,
    backgroundColor: '#D26A5C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  generateLabel: {
    fontFamily: 'Jua',
    fontSize: 24,
    lineHeight: 31,
    color: '#F3F5F6',
    textAlign: 'center',
  },
  emoji: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: '#FFC94F',
  },
  notice: {
    marginBottom: 12,
    fontFamily: 'Jua',
    fontSize: 16,
    lineHeight: 22,
    color: '#D26A5C',
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
});
