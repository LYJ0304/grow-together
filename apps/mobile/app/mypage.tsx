import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { BottomNavigation } from '../src/components/bottom-navigation';

const menuGroups = [
  {
    title: '가족 관리',
    items: [
      { title: '가족 정보', description: '보호자와 아이 정보' },
      { title: '아이 프로필', description: '이름과 생일 관리' },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { title: '알림 설정', description: '기록 알림 관리' },
      { title: '앱 정보', description: '버전 1.0' },
    ],
  },
];

export default function MyPageScreen() {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [notice, setNotice] = useState('');

  // shortcut: profile values are preview data until the mobile profile API is connected.
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(14, 68 - insets.top) },
        ]}
      >
        <Text accessibilityRole="header" style={styles.title}>
          마이페이지
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>가</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>사랑둥이 가족</Text>
            <Text style={styles.profileDays}>
              아이와 함께한 지 <Text style={styles.accent}>+378일</Text>
            </Text>
          </View>
        </View>

        {menuGroups.map((group) => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.menuCard}>
              {group.items.map((item, index) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  onPress={() =>
                    setNotice(`${item.title} 화면은 준비 중입니다.`)
                  }
                  style={({ pressed }) => [
                    styles.menuItem,
                    index < group.items.length - 1 && styles.menuDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.menuText}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuDescription}>
                      {item.description}
                    </Text>
                  </View>
                  <Text style={styles.chevron} accessible={false}>
                    ›
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => setNotice('로그아웃 기능은 준비 중입니다.')}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.logoutLabel}>로그아웃</Text>
        </Pressable>

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

      <BottomNavigation
        active="마이"
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    marginBottom: 22,
    fontFamily: 'Jua',
    fontSize: 28,
    lineHeight: 36,
    color: '#4F4F4F',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 28,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 12px rgba(84, 87, 92, 0.08)',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDEDE6',
  },
  avatarLabel: { fontFamily: 'Jua', fontSize: 25, color: '#D26A5C' },
  profileText: { flex: 1, gap: 5 },
  profileName: { fontFamily: 'Jua', fontSize: 20, color: '#4F4F4F' },
  profileDays: { fontFamily: 'Jua', fontSize: 14, color: '#858895' },
  accent: { color: '#D26A5C' },
  section: { marginBottom: 22 },
  sectionTitle: {
    marginBottom: 10,
    paddingHorizontal: 4,
    fontFamily: 'Jua',
    fontSize: 17,
    color: '#4F4F4F',
  },
  menuCard: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  menuItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEF',
  },
  menuText: { flex: 1, gap: 3 },
  menuTitle: { fontFamily: 'Jua', fontSize: 16, color: '#4F4F4F' },
  menuDescription: { fontFamily: 'Jua', fontSize: 12, color: '#A0A3B1' },
  chevron: { fontFamily: 'Jua', fontSize: 26, color: '#A0A3B1' },
  notice: {
    marginBottom: 12,
    fontFamily: 'Jua',
    fontSize: 15,
    lineHeight: 22,
    color: '#D26A5C',
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },
  logoutButton: { alignItems: 'center', paddingVertical: 14 },
  logoutLabel: { fontFamily: 'Jua', fontSize: 16, color: '#C62828' },
});
