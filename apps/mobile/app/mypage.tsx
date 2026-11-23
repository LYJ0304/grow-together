import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from '../src/components/auth-provider';
import { AccountHeader } from '../src/components/account-header';
import { ActionButton } from '../src/components/action-button';
import { useChildProfile } from '../src/lib/use-child-profile';
import { useUserProfile } from '../src/lib/use-user-profile';
import { dateLabel } from '../src/lib/onboarding';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

export default function MyPageScreen() {
  const { client, status } = useAuth();
  const user = useUserProfile();
  const child = useChildProfile();
  const childLabel = child.isError
    ? '아이 정보를 불러오지 못했어요.'
    : child.isPending
      ? '아이 정보 확인 중'
      : child.data
        ? `${child.data.name} · ${dateLabel(child.data.birthday)}`
        : '아이 정보를 등록해주세요.';
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={styles.screen}
    >
      <StatusBar style="dark" />
      <AccountHeader
        title="마이페이지"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/main')
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            내 프로필
          </Text>
          {status === 'preview' ? (
            <View style={styles.summary}>
              <Avatar />
              <View style={styles.copy}>
                <Text style={styles.name}>미리보기 이용 중</Text>
                <Text style={styles.caption}>
                  로그인하면 내 계정 정보를 관리할 수 있어요.
                </Text>
              </View>
            </View>
          ) : user.data ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="내 프로필 수정"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [
                styles.summary,
                pressed && styles.pressed,
              ]}
            >
              <Avatar />
              <View style={styles.copy}>
                <Text style={styles.name}>{user.data.name}</Text>
                <Text style={styles.body}>{user.data.email}</Text>
                <Text style={styles.caption}>프로필 수정</Text>
              </View>
              <Text accessible={false} style={styles.chevron}>
                ›
              </Text>
            </Pressable>
          ) : user.isError ? (
            <View style={styles.group}>
              <Text accessibilityRole="alert" style={styles.body}>
                내 정보를 불러오지 못했어요.
              </Text>
              <ActionButton
                label="내 정보 다시 불러오기"
                variant="secondary"
                onPress={() => void user.refetch()}
              />
            </View>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              내 정보 확인 중
            </Text>
          )}
          {user.data && user.isError ? (
            <ActionButton
              label="내 정보 다시 불러오기"
              variant="secondary"
              onPress={() => void user.refetch()}
            />
          ) : null}
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            가족 정보
          </Text>
          <View style={styles.group}>
            <MenuRow
              label="아이 정보 관리"
              detail={childLabel}
              onPress={() => router.push('/children')}
            />
            {child.isError ? (
              <ActionButton
                label="아이 정보 다시 불러오기"
                variant="secondary"
                onPress={() => void child.refetch()}
              />
            ) : null}
          </View>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            계정 및 설정
          </Text>
          <View style={styles.group}>
            <Text style={styles.body}>
              {status === 'preview'
                ? '미리보기로 이용하고 있어요.'
                : '로그인한 계정의 이름과 이메일은 내 프로필에서 확인할 수 있어요.'}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.body}>알림</Text>
            <Text style={styles.caption}>알림 기능은 준비 중이에요.</Text>
          </View>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            개인정보 관리
          </Text>
          <View style={styles.group}>
            <MenuRow
              label="기록 관리"
              detail="저장한 일기를 확인하고 관리해요."
              onPress={() => router.navigate('/calendar')}
            />
          </View>
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            앱 정보
          </Text>
          <Text style={styles.caption}>
            버전 {Constants.expoConfig?.version ?? '확인 불가'}
          </Text>
        </View>
        <ActionButton
          label={status === 'preview' ? '미리보기 종료' : '로그아웃'}
          variant="tertiary"
          onPress={() => void client.logout()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
function Avatar() {
  return (
    <View style={styles.avatar}>
      <Image
        source={require('../assets/images/main/user.svg')}
        tintColor={colors.brand}
        style={{ width: 28, height: 28 }}
        accessible={false}
      />
    </View>
  );
}
function MenuRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.body}>{label}</Text>
        <Text style={styles.caption}>{detail}</Text>
      </View>
      <Text accessible={false} style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 24,
    paddingBottom: 32,
  },
  section: { gap: 12 },
  heading: { ...typography.section, color: colors.heading },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.muted },
  name: { ...typography.section, color: colors.heading },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 88,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevron: { fontSize: 24, color: colors.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  pressed: { backgroundColor: colors.border },
});
