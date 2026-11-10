import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReduceMotion } from '../src/theme/motion';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { createChildApi } from '../src/lib/features/child/childApi';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthProvider, useAuth } from '../src/components/auth-provider';
import { LaunchTransitionProvider } from '../src/components/launch-transition';

const queryClient = new QueryClient();

function AuthenticatedStack() {
  const { client, status, notice, epoch, accountKey } = useAuth();
  const reduced = useReduceMotion();
  const profile = useQuery({
    queryKey: ['childProfile', accountKey, epoch],
    enabled: status === 'authenticated',
    queryFn: () => createChildApi(client).getProfile(),
    retry: false,
  });
  if (
    status === 'restoring' ||
    status === 'restoreError' ||
    status === 'storageError'
  ) {
    return (
      <View style={styles.loading}>
        {status === 'restoring' ? (
          <>
            <ActivityIndicator />
            <Text>로그인을 확인하고 있어요.</Text>
          </>
        ) : (
          <>
            <Text accessibilityRole="alert">{notice}</Text>
            {status === 'restoreError' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void client.restore()}
                style={styles.button}
              >
                <Text>다시 시도</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void client.logout()}
              style={styles.button}
            >
              <Text>로그아웃하고 로그인 화면으로</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }
  const hasAccess = status === 'authenticated' || status === 'preview';
  const checkingProfile =
    status === 'authenticated' && profile.data === undefined;
  return (
    <View style={styles.root}>
      <View
        style={{ flex: 1 }}
        pointerEvents={checkingProfile ? 'none' : 'auto'}
        accessibilityElementsHidden={checkingProfile}
        importantForAccessibility={
          checkingProfile ? 'no-hide-descendants' : 'auto'
        }
      >
        <Stack
          key={hasAccess ? epoch : 'signed-out'}
          screenOptions={{
            headerShown: false,
            animation: reduced ? 'none' : 'default',
            gestureEnabled: true,
            contentStyle: { backgroundColor: '#FAF9F9' },
          }}
        >
          <Stack.Protected guard={!hasAccess}>
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="index" />
            <Stack.Screen name="app-name" />
            <Stack.Screen name="welcome" />
          </Stack.Protected>
          <Stack.Protected
            guard={hasAccess && (status === 'preview' || profile.data !== null)}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="mypage" />
            <Stack.Screen name="children" />
            <Stack.Screen name="spouse" />
            <Stack.Screen name="persona" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'authenticated'}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      </View>
      {checkingProfile ? (
        <View style={[StyleSheet.absoluteFillObject, styles.loading]}>
          {profile.isError ? (
            <>
              <Text accessibilityRole="alert">
                아이 정보를 확인하지 못했어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => void profile.refetch()}
              >
                <Text>아이 정보 다시 확인</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => void client.logout()}
              >
                <Text>로그아웃</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator />
              <Text>아이 정보를 확인하고 있어요.</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jua: require('../assets/fonts/Jua-Regular.ttf'),
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LaunchTransitionProvider>
            <AuthenticatedStack />
          </LaunchTransitionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#FAF9F9',
  },
  button: { minHeight: 44, padding: 12, justifyContent: 'center' },
});
