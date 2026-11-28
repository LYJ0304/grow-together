import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../components/auth-provider';
import { createDiaryApi } from './features/diary/diaryApi';
import type { DiaryResponse } from './features/diary/types';

export function useRecordIndex(months: string[], visibleDates: string[]) {
  const { client, status, epoch } = useAuth();
  const scope = epoch;
  const queryClient = useQueryClient();
  const activeMonths = useRef(months);
  activeMonths.current = months;
  const activeDates = useRef(visibleDates);
  activeDates.current = visibleDates;
  const remote = useQueries({
    queries: months.map((month) => ({
      queryKey: ['savedDiaryDates', epoch, month],
      queryFn: async () =>
        (await createDiaryApi(client).getMonth(month))
          .map((row) => row.diaryDate)
          .filter((date) => date.startsWith(month)),
      enabled: status === 'authenticated',
      staleTime: 30_000,
      retry: false,
    })),
  });
  const stateFor = (month: string) => remote[months.indexOf(month)];
  const dates = new Set(remote.flatMap((query) => query.data ?? []));
  const refresh = useCallback(() => {
    const keys = activeMonths.current.map((month) => [
      'savedDiaryDates',
      epoch,
      month,
    ]);
    for (const queryKey of keys) {
      // Initial queries already own their pending request; refresh cached data on return.
      const state = queryClient.getQueryState(queryKey);
      if (
        state?.fetchStatus !== 'fetching' &&
        (state?.dataUpdatedAt || state?.status === 'error')
      )
        void queryClient.invalidateQueries({ queryKey, exact: true });
    }
    for (const date of activeDates.current) {
      const queryKey = ['diaryByDate', scope, date];
      const state = queryClient.getQueryState(queryKey);
      if (state?.fetchStatus !== 'fetching' && state?.dataUpdatedAt)
        void queryClient.invalidateQueries({ queryKey, exact: true });
    }
  }, [epoch, scope, queryClient]);
  useFocusEffect(refresh);
  return {
    dates,
    stateFor,
    refresh,
    retry: () => {
      for (const query of remote) void query.refetch();
    },
    queries: remote,
  };
}

export type RecordPreview = {
  id?: number;
  date: string;
  content: string;
  photo?: string;
  photoCount: number;
  activities: string[];
};
export function useRecordPreview(date: string, visible: boolean) {
  const { client, status, epoch } = useAuth();
  return useQuery<DiaryResponse | null, Error, RecordPreview>({
    queryKey: ['diaryByDate', epoch, date],
    queryFn: () => createDiaryApi(client).getByDate(date),
    enabled: visible && status === 'authenticated',
    staleTime: (query) => (query.state.data ? 30_000 : 0),
    retry: false,
    select: (value) => {
      if (!value) throw new Error('기록을 다시 확인해주세요.');
      const remote = value as DiaryResponse;
      return {
        id: remote.id,
        date,
        content: remote.content ?? '',
        photo: remote.diaryFiles?.[0]?.imageUrl,
        photoCount: remote.diaryFiles?.length ?? 0,
        activities: remote.todos?.map((todo) => todo.planName) ?? [],
      };
    },
  });
}
