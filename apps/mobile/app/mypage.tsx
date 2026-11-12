import { PageIntro } from '../src/components/page-intro';
import { editorial } from '../src/theme/editorial';
import { colors } from '../src/theme/colors';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/components/auth-provider';
import { typography } from '../src/components/typography';
import { useChildProfile } from '../src/lib/use-child-profile';

export default function MyPageScreen() {
  const { client, status } = useAuth();
  const profile = useChildProfile();
  const profileLabel = profile.isError
    ? '아이 정보 조회 실패'
    : profile.isPending
      ? '아이 정보 불러오는 중'
      : profile.data
        ? `${profile.data.name} · ${profile.data.birthday}`
        : '등록된 아이가 없어요';
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 화면으로"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/main')
          }
          style={styles.back}
        >
          <Text style={styles.link}>‹ 뒤로</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          설정
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <PageIntro
          eyebrow="GROW TOGETHER / 내 공간"
          title="아이와 나의 공간"
          description="아이 정보와 계정의 기록을 관리해요."
        />
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.section}>
            계정
          </Text>
          <Text style={styles.body}>
            {status === 'preview' ? '미리보기 이용 중' : '로그인되어 있어요.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void client.logout()}
            style={styles.button}
          >
            <Text style={styles.logout}>
              {status === 'preview' ? '미리보기 종료' : '로그아웃'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.section}>
            아이 정보 관리
          </Text>
          <Text style={styles.caption}>{profileLabel}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/children')}
            style={styles.button}
          >
            <Text style={styles.link}>아이 프로필</Text>
            <Text style={styles.caption}>
              {profile.data ? '이름과 생일 수정하기' : '아이 정보 추가하기'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.section}>
            기록과 개인정보
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/calendar')}
            style={styles.button}
          >
            <Text style={styles.link}>기록 관리 ›</Text>
          </Pressable>
          <Text style={styles.caption}>
            AI가 정리한 초안은 직접 확인하고 저장해요. 리포트와 질문의 연결
            상태는 각 화면에서 확인할 수 있어요.
          </Text>
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.section}>
            앱 정보
          </Text>
          <Text style={styles.body}>
            버전 {Constants.expoConfig?.version ?? '확인 불가'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 16,
    gap: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { minWidth: 60, minHeight: 44, justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
  },
  card: { ...editorial.card, gap: 12 },
  title: { ...typography.title, color: colors.text },
  section: { ...typography.section, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  link: { ...typography.button, color: colors.primary },
  logout: { ...typography.button, color: colors.danger },
  button: { minHeight: 48, paddingVertical: 10, gap: 4 },
});
