import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { getHealth } from '../src/lib/api/client';

export default function HomeScreen() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: 1,
  });
  const message = health.isPending
    ? 'Checking API connection…'
    : health.isError
      ? 'API is unavailable. Check EXPO_PUBLIC_API_URL.'
      : `${health.data.service} is ${health.data.status}`;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Growtogegher</Text>
      <Text style={styles.subtitle}>Your AI-enabled growth companion</Text>
      <Text accessibilityRole="summary" style={styles.status}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  title: { fontSize: 32, fontWeight: '700', color: '#1B1B1B' },
  subtitle: { marginTop: 8, fontSize: 16, color: '#666' },
  status: { marginTop: 32, fontSize: 14, color: '#3E6B4A' },
});
