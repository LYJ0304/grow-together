import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { typography } from './typography';

export function ProfileEntry({ disabled = false }: { disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel="프로필과 설정"
      onPress={() => router.push('/mypage')}
      style={{
        minHeight: 44,
        padding: 10,
        alignSelf: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Text style={[typography.label, { color: '#A84D40' }]}>
        아이 프로필 · 설정
      </Text>
    </Pressable>
  );
}
