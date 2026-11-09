import { Stack } from 'expo-router';
import { useReduceMotion } from '../../../src/theme/motion';
import { colors } from '../../../src/theme/colors';
export const unstable_settings = { initialRouteName: 'calendar' };
export default function RecordsLayout() {
  const reduced = useReduceMotion();
  return (
    <Stack
      initialRouteName="calendar"
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'default',
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="calendar" />
      <Stack.Screen name="diary" />
    </Stack>
  );
}
