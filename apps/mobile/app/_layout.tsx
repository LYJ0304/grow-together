import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
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
  const { client, status, notice } = useAuth();
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
  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Protected guard={!hasAccess}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="index" />
          <Stack.Screen name="app-name" />
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={hasAccess}>
          <Stack.Screen name="main" />
          <Stack.Screen name="todo" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="diary" />
          <Stack.Screen name="mypage" />
          <Stack.Screen name="children" />
          <Stack.Screen name="spouse" />
          <Stack.Screen name="persona" />
          <Stack.Screen name="chat" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jua: require('../assets/fonts/Jua-Regular.ttf'),
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LaunchTransitionProvider>
          <AuthenticatedStack />
        </LaunchTransitionProvider>
      </AuthProvider>
    </QueryClientProvider>
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
