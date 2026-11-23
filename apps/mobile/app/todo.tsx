import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyTodo() {
  const params = useLocalSearchParams<{ date?: string; add?: string; recommend?: string }>();
  return <Redirect href={{ pathname: '/calendar', params }} />;
}
