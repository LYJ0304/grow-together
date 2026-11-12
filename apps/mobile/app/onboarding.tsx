import { useRef } from 'react';
import { View, Text } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/components/auth-provider';
import { useChildProfile } from '../src/lib/use-child-profile';
import type { ChildProfile } from '../src/lib/child-profile';
import { ChildOnboarding } from '../src/components/onboarding/child-onboarding';
import { ActionButton } from '../src/components/action-button';
export default function OnboardingScreen() {
  const { accountKey, epoch, status, client } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const profile = useChildProfile();
  // Freeze the initial intent. A POST response/background GET must not turn
  // an unfinished registration into an implicit PUT or hide a partial-save warning.
  const initial = useRef<{ value: ChildProfile | null } | null>(null);
  if (profile.isSuccess && !initial.current)
    initial.current = { value: profile.data ?? null };
  if (status !== 'authenticated') return <Redirect href="/login" />;
  if (!initial.current)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text accessibilityRole={profile.isError ? 'alert' : undefined}>
          {profile.isError
            ? '아이 정보를 확인하지 못했어요.'
            : '아이 정보를 확인하고 있어요.'}
        </Text>
        {profile.isError ? (
          <>
            <ActionButton
              label="아이 정보 다시 확인"
              onPress={() => void profile.refetch()}
            />
            <ActionButton
              label="로그아웃"
              tone="rose"
              onPress={() => void client.logout()}
            />
          </>
        ) : null}
      </View>
    );
  if (initial.current.value && edit !== 'true')
    return <Redirect href="/main" />;
  return (
    <ChildOnboarding
      key={`${accountKey}:${epoch}`}
      initial={initial.current.value}
    />
  );
}
