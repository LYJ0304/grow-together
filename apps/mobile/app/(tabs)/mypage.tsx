import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/safe-area-view';
import { useAuth } from '@/components/auth-provider';
import { AccountHeader } from '@/components/account-header';
import { ActionButton } from '@/components/action-button';
import { useChildProfile } from '@/lib/use-child-profile';
import { useUserProfile } from '@/lib/use-user-profile';
import { dateLabel } from '@/lib/onboarding';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
export default function MyPageScreen() {
  const { client } = useAuth();
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
          {user.data ? (
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
          <MenuRow label="성장 리포트" onPress={() => router.push('/report')} />
          <Text accessibilityRole="header" style={styles.heading}>
            계정 및 설정
          </Text>
          <View style={styles.group}>
            <MenuRow
              label="알림 설정"
              detail="알림 항목을 미리 살펴봐요."
              onPress={() => router.push('/notification-settings')}
            />
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
            도움말 및 지원
          </Text>
          <View style={styles.group}>
            <MenuRow
              label="도움말"
              detail="자주 묻는 질문을 확인해요."
              onPress={() => router.push('/help')}
            />
            <View style={styles.divider} />
            <MenuRow
              label="문의하기"
              detail="문의 화면을 미리 살펴봐요."
              onPress={() => router.push('/contact')}
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
        <MenuRow
          label="회원 탈퇴"
          detail="계정과 개인정보를 삭제해요."
          onPress={() => router.push('/withdrawal')}
        />
        <ActionButton
          label={'로그아웃'}
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
        source={require('../../assets/images/main/user.svg')}
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
  detail?: string;
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
        {detail ? <Text style={styles.caption}>{detail}</Text> : null}
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
