import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '../components/auth-provider';
import { readChildProfile } from './child-profile';

export function useChildProfile() {
  const { accountKey, epoch } = useAuth();
  const queryKey = ['childProfile', accountKey, epoch] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => readChildProfile(accountKey!),
    enabled: accountKey !== null,
    retry: false,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (accountKey) void refetch();
    }, [accountKey, refetch]),
  );
  return { ...query, queryKey, accountKey };
}
