import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// shortcut: sample profiles until a member search API is available.
const sampleProfiles = [
  { id: 'sample-001', name: '김민준' },
  { id: 'sample-002', name: '김서연' },
  { id: 'sample-003', name: '이민준' },
];

export default function SpouseScreen() {
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [error, setError] = useState('');
  const results = submittedQuery
    ? sampleProfiles.filter((profile) => profile.name.includes(submittedQuery))
    : [];

  function search() {
    const trimmed = query.trim();
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setError(trimmed ? '' : '배우자의 이름을 입력해 주세요.');
  }

  function reset() {
    setQuery('');
    setSubmittedQuery('');
    setError('');
    input.current?.focus();
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.eyebrow}>함께하는 육아의 시작</Text>
        <Text accessibilityRole="header" style={styles.title}>
          배우자 찾기
        </Text>
        <Text style={styles.description}>
          함께할 배우자를 이름으로 검색해 보세요.
        </Text>

        <View style={styles.searchCard}>
          <Text style={styles.label}>배우자 이름</Text>
          <View style={styles.searchRow}>
            <View style={styles.inputBox}>
              <Image
                source={require('../assets/images/main/search.svg')}
                style={styles.searchIcon}
                accessible={false}
              />
              <TextInput
                ref={input}
                accessibilityLabel="배우자 이름"
                placeholder="이름을 입력해 주세요"
                placeholderTextColor="#858895"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색"
              onPress={search}
              style={({ pressed }) => [
                styles.searchButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.searchLabel}>검색</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="검색 초기화"
            onPress={reset}
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetLabel}>검색 초기화</Text>
          </Pressable>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.sampleNotice}>
          <Text style={styles.sampleTitle}>예시 데이터로 둘러보기</Text>
          <Text style={styles.description}>
            현재 검색 결과는 실제 회원이 아닌 예시입니다.{'\n'}
            ‘김’ 또는 ‘민준’을 검색해 보세요.
          </Text>
        </View>

        <View accessibilityLiveRegion="polite">
          {submittedQuery ? (
            <>
              <Text accessibilityRole="header" style={styles.resultsTitle}>
                검색 결과 {results.length}명
              </Text>
              <Text style={styles.queryLabel}>
                ‘{submittedQuery}’ 검색 결과
              </Text>
              {results.length ? (
                results.map((profile) => (
                  <View key={profile.id} style={styles.profileCard}>
                    <View style={styles.avatar} accessible={false}>
                      <Text style={styles.avatarLabel}>{profile.name[0]}</Text>
                    </View>
                    <View style={styles.profileText}>
                      <Text style={styles.profileName}>{profile.name}</Text>
                      <Text style={styles.description}>
                        예시 ID · {profile.id}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
                  <Text style={styles.description}>
                    이름을 확인하거나 다른 이름으로 검색해 주세요.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                배우자의 이름을 검색해 보세요
              </Text>
              <Text style={styles.description}>
                검색하면 이곳에 결과가 표시돼요.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F9' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 32,
  },
  eyebrow: { fontFamily: 'Jua', fontSize: 14, color: '#D26A5C' },
  title: {
    fontFamily: 'Jua',
    fontSize: 28,
    lineHeight: 36,
    color: '#4F4F4F',
    marginTop: 8,
    marginBottom: 8,
  },
  description: {
    fontFamily: 'Jua',
    fontSize: 14,
    lineHeight: 22,
    color: '#666975',
  },
  searchCard: {
    marginTop: 28,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 3px 12px rgba(84, 87, 92, 0.08)',
  },
  label: {
    fontFamily: 'Jua',
    fontSize: 16,
    color: '#4F4F4F',
    marginBottom: 12,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E3E3',
    borderRadius: 12,
  },
  searchIcon: { width: 18, height: 18 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontFamily: 'Jua',
    fontSize: 14,
    color: '#4F4F4F',
  },
  searchButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#D26A5C',
  },
  searchLabel: { fontFamily: 'Jua', fontSize: 16, color: '#FFFFFF' },
  resetButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  resetLabel: { fontFamily: 'Jua', fontSize: 14, color: '#666975' },
  error: { fontFamily: 'Jua', fontSize: 14, color: '#B44336' },
  sampleNotice: {
    marginVertical: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FDEDE6',
    gap: 6,
  },
  sampleTitle: { fontFamily: 'Jua', fontSize: 15, color: '#9C4B40' },
  resultsTitle: { fontFamily: 'Jua', fontSize: 20, color: '#4F4F4F' },
  queryLabel: {
    fontFamily: 'Jua',
    fontSize: 14,
    color: '#666975',
    marginTop: 6,
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FDEDE6',
  },
  avatarLabel: { fontFamily: 'Jua', fontSize: 22, color: '#D26A5C' },
  profileText: { flex: 1, gap: 4 },
  profileName: { fontFamily: 'Jua', fontSize: 18, color: '#4F4F4F' },
  emptyCard: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontFamily: 'Jua', fontSize: 18, color: '#4F4F4F' },
  pressed: { opacity: 0.8 },
});
