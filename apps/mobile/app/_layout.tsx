import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { LaunchTransitionProvider } from '../src/components/launch-transition';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jua: require('../assets/fonts/Jua-Regular.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <LaunchTransitionProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </LaunchTransitionProvider>
    </QueryClientProvider>
  );
}
