import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../components/auth-provider';
import { createUserApi } from './features/user/userApi';
export function useUserProfile() {
  const { client, status, accountKey, epoch } = useAuth();
  const enabled = status === 'authenticated';
  const queryKey = ['userProfile', accountKey, epoch] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => createUserApi(client).getProfile(),
    enabled,
    retry: false,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch]),
  );
  return { ...query, queryKey };
}
