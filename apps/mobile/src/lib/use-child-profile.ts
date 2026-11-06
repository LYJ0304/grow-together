import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '../components/auth-provider';
import { readChildProfile } from './child-profile';
import { createChildApi } from './features/child/childApi';

export function useChildProfile() {
  const { client, status, accountKey, epoch } = useAuth();
  const enabled =
    accountKey !== null && (status === 'authenticated' || status === 'preview');
  const queryKey = ['childProfile', accountKey, epoch] as const;
  const query = useQuery({
    queryKey,
    queryFn: () =>
      status === 'preview'
        ? readChildProfile(accountKey!)
        : createChildApi(client).getProfile(),
    enabled,
    retry: false,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch]),
  );
  return { ...query, queryKey, accountKey };
}
